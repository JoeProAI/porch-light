const resources = [
  {
    name: "National Weather Service", category: "Official warnings",
    href: "https://www.weather.gov/",
    detail: "Local forecast offices, official watches, warnings and safety instructions.",
    access: "Public information",
  },
  {
    name: "HHS emPOWER", category: "Medically vulnerable populations",
    href: "https://empowerprogram.hhs.gov/empowermap",
    detail: "Public aggregate population context. The program's individual outreach datasets require authorized access.",
    access: "Public map; restricted datasets are separate",
  },
  {
    name: "FEMA Resilience Analysis and Planning Tool", category: "Community risk planning",
    href: "https://rapt-fema.hub.arcgis.com/",
    detail: "FEMA's official resource center for public hazard, population, infrastructure and resilience mapping.",
    access: "Public resource center and application links",
  },
  {
    name: "Kidney Community Emergency Response", category: "Dialysis preparedness",
    href: "https://www.kcercoalition.com/en/resources/professional-resources/emergency-preparedness",
    detail: "Dialysis emergency resources and coordination information for healthcare professionals.",
    access: "Public resources; reporting access varies",
  },
  {
    name: "IPRO Healthcare Emergency Hub", category: "Patients and providers",
    href: "https://esrd.ipro.org/emergency-management/healthcare-emergency-hub-2/",
    detail: "Preparedness tools and information about IPRO's separate emergency resource app.",
    access: "Public information and app links",
  },
  {
    name: "Florida AHCA HFRS", category: "Required facility reporting",
    href: "https://ahca.myflorida.com/health-quality-assurance/hfrs.html",
    detail: "Florida's official facility reporting information. Porch Light doesn't replace required reporting.",
    access: "Information is public; the reporting system requires authorization",
  },
];

export const ResourceLinks = () => (
  <section className="resource-section" id="resources" aria-labelledby="resources-title">
    <div className="resource-intro">
      <p className="eyebrow">Another resource, not another authority</p>
      <h2 id="resources-title">Use Porch Light<br />alongside the people<br />already doing the work.</h2>
      <p>Official agencies, healthcare coalitions and existing response systems remain essential. These independent links are informational, not partnerships, endorsements or integrations.</p>
      <p className="fineprint">Links open the original sites. Availability and access rules are set by each organization. No restricted records are accessed here.</p>
    </div>
    <ul className="resource-list">{resources.map(resource => (
      <li key={resource.name}>
        <span className="eyebrow">{resource.category}</span>
        <a href={resource.href} target="_blank" rel="noreferrer">{resource.name}<span aria-hidden="true">↗</span></a>
        <p>{resource.detail}</p><small>{resource.access}</small>
      </li>
    ))}</ul>
  </section>
);
