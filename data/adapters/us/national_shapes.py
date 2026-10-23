"""Read official NWS polygon/DBF archives without adding a GIS dependency."""

import math
import struct
from pathlib import Path
from zipfile import ZipFile

from data.provenance.sidecar import verify


def read_shapes(path: Path) -> list[dict]:
    if not verify(path):
        raise ValueError("NWS shape archive provenance does not verify")
    with ZipFile(path) as archive:
        files = archive.namelist()
        projection = archive.read(next(name for name in files if name.lower().endswith(".prj"))).decode()
        if "PROJCS" in projection:
            raise ValueError("Unsupported projected NWS coordinate system")
        if "WGS_1984" in projection or 'GEOGCS["WGS 84"' in projection:
            srid = 4326
        elif "North_American_1983" in projection or 'GEOGCS["NAD83"' in projection:
            srid = 4269
        else:
            raise ValueError("NWS coordinates have an unsupported declared geographic datum")
        dbf = archive.read(next(name for name in files if name.lower().endswith(".dbf")))
        shp = archive.read(next(name for name in files if name.lower().endswith(".shp")))
    count, header_size, record_size = struct.unpack_from("<IHH", dbf, 4)
    fields, offset = [], 32
    while offset < header_size and dbf[offset] != 13:
        descriptor = dbf[offset:offset + 32]
        fields.append((descriptor[:11].split(b"\0")[0].decode("ascii"), descriptor[16]))
        offset += 32
    attributes = []
    for index in range(count):
        record = dbf[header_size + index * record_size:header_size + (index + 1) * record_size]
        if len(record) != record_size or record[:1] == b"*":
            raise ValueError("NWS DBF contains an incomplete or deleted source record")
        row, start = {}, 1
        for name, size in fields:
            row[name] = record[start:start + size].decode("latin-1").strip()
            start += size
        attributes.append(row)
    offset, output = 100, []
    while offset < len(shp):
        if len(shp) - offset < 8:
            raise ValueError("Truncated NWS shape record")
        _, words = struct.unpack_from(">II", shp, offset)
        content = shp[offset + 8:offset + 8 + words * 2]
        offset += 8 + words * 2
        shape_type = struct.unpack_from("<I", content)[0]
        if shape_type not in (5, 15, 25):
            raise ValueError("NWS archive contains a non-polygon source record")
        part_count, point_count = struct.unpack_from("<II", content, 36)
        if not 1 <= part_count <= point_count or point_count > 10000000:
            raise ValueError("Invalid NWS polygon part counts")
        starts = list(struct.unpack_from("<" + "I" * part_count, content, 44)) + [point_count]
        points = [struct.unpack_from("<dd", content, 44 + 4 * part_count + 16 * index)
                  for index in range(point_count)]
        if any(not math.isfinite(x) or not math.isfinite(y) or not -180.001 <= x <= 180.001 or
               not -90 <= y <= 90 for x, y in points):
            raise ValueError("NWS source coordinate is outside geographic bounds")
        rings = []
        for index in range(part_count):
            ring = points[starts[index]:starts[index + 1]]
            if len(ring) < 4 or ring[0] != ring[-1]:
                raise ValueError("NWS source polygon ring is not closed")
            rings.append("(" + ",".join(f"{x!r} {y!r}" for x, y in ring) + ")")
        if len(output) >= len(attributes):
            raise ValueError("NWS shape and attribute identities disagree")
        # PostGIS ST_BuildArea reconstructs nesting and holes from the original rings.
        output.append({"properties": attributes[len(output)],
                       "srid": srid,
                       "boundary_wkt": "MULTILINESTRING(" + ",".join(rings) + ")"})
    if len(output) != len(attributes):
        raise ValueError("NWS shape and DBF record counts disagree")
    return output
