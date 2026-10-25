const projectParameter = {
  name: "projectId",
  in: "query",
  required: true,
  schema: { type: "string", format: "uuid" },
};
const responses = {
  "400": { description: "Invalid identifier or upload form" },
  "401": {
    description:
      "Full owner session required; scoped MCP/developer tokens are not accepted",
  },
  "404": { description: "Owned project/file not found" },
  "409": { description: "Concurrent update; retry" },
  "413": { description: "File/quota limit exceeded" },
  "415": { description: "Unsupported extension or file signature" },
  "429": { description: "Rate limited" },
  "503": { description: "Private storage unavailable" },
};
export const attachmentPaths = {
  "/api/attachments": {
    get: {
      operationId: "listPrivateAttachments",
      summary: "List owned project files and per-account file quota",
      security: [{ SessionCookie: [] }],
      parameters: [projectParameter],
      responses: {
        "200": {
          description:
            "Private file metadata, SHA-256 and upload status; no public object URLs",
        },
        ...responses,
      },
    },
    post: {
      operationId: "uploadPrivateAttachment",
      summary:
        "Store an original file privately without starting AI processing",
      security: [{ SessionCookie: [] }],
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              required: ["projectId", "file"],
              properties: {
                projectId: { type: "string", format: "uuid" },
                file: {
                  type: "string",
                  format: "binary",
                  description:
                    "Up to 4 MB; PDF, PNG, JPEG, STEP, STL, UTF-8 TXT or JSON",
                },
              },
            },
          },
        },
      },
      responses: {
        "201": { description: "Stored private attachment metadata" },
        ...responses,
      },
    },
  },
  "/api/attachments/{id}": {
    parameters: [
      projectParameter,
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
    ],
    get: {
      operationId: "downloadPrivateAttachment",
      summary:
        "Stream original bytes after owner checks; private/no-store, attachment disposition",
      security: [{ SessionCookie: [] }],
      responses: {
        "200": {
          description: "Original file bytes",
          content: {
            "application/octet-stream": {
              schema: { type: "string", format: "binary" },
            },
          },
        },
        ...responses,
      },
    },
    delete: {
      operationId: "deletePrivateAttachment",
      summary: "Delete the owned object and release its quota",
      security: [{ SessionCookie: [] }],
      responses: { "200": { description: "Deleted" }, ...responses },
    },
  },
};
