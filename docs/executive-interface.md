# Executive interface

The CEO shell presents two companies: Double Deer Studio (client accounts) and Double Deer Originals (FAM, Event IP, Retail). Today, Priorities, Decisions, Projects, People, Meetings, Inbox, Search and Settings remain available. Tasks, Pipeline, Google and Sources are in Workspace tools. Sources retains the original Google source records.

`src/presentation/hierarchy.ts` projects the existing workspace into the executive hierarchy. This projection must never be saved as the raw workspace. Existing persistence callbacks continue saving the original data. Legacy company IDs, source archives and migration contracts remain compatible; a later schema migration requires separate review.

`src/domain/executive.ts` adds Company/BusinessUnit/ClientAccount/ProjectPlacement/Initiative/Metric types. Financial charts use isolated, clearly labelled illustrative metrics only for the sample dataset. Live revenue is unreported until a verified metric adapter is supplied. Pipeline forecasts are not recognized revenue.

Plaud and GPT Projects have an additive capture workflow in Sources. TXT/MD transcripts, simple transcript JSON and ChatGPT conversations.json are supported. Users explicitly select a project (or create one), owner and date; actions are manually reviewed. The preview does not save; applying appends source meetings and actions while retaining all existing source and synchronization metadata. ChatGPT exports follow the active conversation branch; Project membership must be chosen because the export does not reliably expose it. This is file capture, not automatic account synchronization. The existing Custom GPT proposal bridge remains separate and unchanged.

Protected Google services, APIs, configuration, scheduler, transformation, mappings, authentication, source IDs and migrations were not edited. DDO remains read-only for progress monitoring. Existing live synchronization continues while the OS is open.

Next milestone: obtain official Plaud integration capabilities and configure GPT access; design incremental background capture with stable external IDs and explicit write-back rules. Do not claim connection before account authorization and an end-to-end live test.
