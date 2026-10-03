export async function GET(request: Request) {
  const server = new URL(request.url).origin;
  return Response.json({
    openapi: "3.1.0",
    info: {
      title: "KIMO OS",
      version: "1.0.0",
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
          summary: "Read the current workspace and revision",
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
