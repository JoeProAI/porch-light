import com.google.gson.Gson;
import com.google.gson.JsonObject;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;

public class ZetarisQuery {
    public static void main(String[] args) {
        Gson gson = new Gson();
        try {
            JsonObject request = gson.fromJson(new InputStreamReader(System.in), JsonObject.class);
            Properties credentials = new Properties();
            credentials.setProperty("user", System.getenv("PORCHLIGHT_ZETARIS_USER"));
            credentials.setProperty("password", System.getenv("PORCHLIGHT_ZETARIS_PASSWORD"));
            Class.forName("com.zetaris.lightning.jdbc.LightningDriver");
            String url = System.getenv().getOrDefault(
                "PORCHLIGHT_ZETARIS_JDBC_URL", "jdbc:zetaris:lightning@localhost:10000"
            );
            try (Connection connection = DriverManager.getConnection(url, credentials);
                 Statement statement = connection.createStatement()) {
                statement.setQueryTimeout(120);
                boolean hasRows = statement.execute(request.get("sql").getAsString());
                List<Map<String, Object>> rows = new ArrayList<>();
                List<Map<String, Object>> columns = new ArrayList<>();
                if (hasRows) {
                    try (ResultSet result = statement.getResultSet()) {
                        ResultSetMetaData metadata = result.getMetaData();
                        for (int i = 1; i <= metadata.getColumnCount(); i++) {
                            Map<String, Object> column = new LinkedHashMap<>();
                            column.put("name", metadata.getColumnLabel(i));
                            column.put("type", metadata.getColumnTypeName(i));
                            columns.add(column);
                        }
                        while (result.next()) {
                            if (rows.size() >= 100000) {
                                throw new IllegalStateException("Query exceeded the bounded result limit");
                            }
                            Map<String, Object> row = new LinkedHashMap<>();
                            for (int i = 1; i <= metadata.getColumnCount(); i++) {
                                Object value = result.getObject(i);
                                if (value instanceof Timestamp) {
                                    value = ((Timestamp) value).toInstant().toString();
                                } else if (value != null && !(value instanceof Number)
                                           && !(value instanceof Boolean) && !(value instanceof String)) {
                                    value = value.toString();
                                }
                                row.put(metadata.getColumnLabel(i), value);
                            }
                            rows.add(row);
                        }
                    }
                }
                Map<String, Object> response = new LinkedHashMap<>();
                response.put("rows", rows);
                response.put("columns", columns);
                response.put("driver_version", connection.getMetaData().getDriverVersion());
                System.out.println("PORCHLIGHT_RESULT:" + gson.toJson(response));
            }
        } catch (Exception error) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("error_type", error.getClass().getSimpleName());
            response.put("message", error.getMessage());
            System.out.println("PORCHLIGHT_RESULT:" + gson.toJson(response));
            System.exit(1);
        }
    }
}
