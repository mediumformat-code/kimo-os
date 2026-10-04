export async function GET(request: Request) {
  const server = new URL(request.url).origin;
  return Response.json({
    openapi: "3.1.0",
    info: {
      title: "KIMO OS",
      version: "1.1.0",
      description:
        "Read private workspace data and submit proposed replacement snapshots for explicit owner review. Never applies edits automatically.",
    },
    servers: [{ url: server }],
    components: {
      schemas: {},
      securitySchemes: { bridgeKey: { type: "http", scheme: "bearer" } },
    },
    security: [{ bridgeKey: [] }],
    paths: {
      "/api/gpt/workspace": {
        get: {
          operationId: "getKimoWorkspace",
          summary:
            "Read compact overview or paginated records. Use section + id for complete record chunks. Never propose replacement from partial data.",
          parameters: [
            {
              name: "section",
              in: "query",
              schema: {
                type: "string",
                enum: [
                  "overview",
                  "projects",
                  "people",
                  "actions",
                  "decisions",
                  "commitments",
                  "meetings",
                  "risks",
                  "inbox",
                  "sourceRecords",
                  "sourceSheets",
                ],
                default: "overview",
              },
            },
            {
              name: "offset",
              in: "query",
              description:
                "List row offset, or character offset when reading a record by id. Follow nextOffset until null.",
              schema: { type: "integer", minimum: 0, default: 0 },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", minimum: 1, maximum: 10, default: 5 },
            },
            {
              name: "id",
              in: "query",
              description:
                "Read a complete record serialized as JSON in 4000-character chunks; concatenate chunks in order and parse JSON.",
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Workspace snapshot",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "object",
                        properties: {},
                        additionalProperties: true,
                      },
                      revision: { type: "integer" },
                      policy: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/gpt/proposals": {
        post: {
          operationId: "proposeKimoWorkspace",
          summary:
            "Submit a complete workspace snapshot for owner review; no immediate writes",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["title", "workspace"],
                  properties: {
                    title: { type: "string", maxLength: 200 },
                    workspace: {
                      type: "object",
                      properties: {},
                      additionalProperties: true,
                      description:
                        "Complete Workspace JSON, preserve all existing entities unless the user explicitly requests removal. Arrays required: companies, projects, people, commitments, decisions, meetings, actions, risks, inbox.",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Proposal saved for owner review",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      status: { type: "string" },
                      message: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}
