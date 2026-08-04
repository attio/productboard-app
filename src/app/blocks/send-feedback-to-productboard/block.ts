import {Workflows} from "attio"

/**
 * Workflow step block that mirrors the "Send feedback" record actions: a workspace
 * member picks a person and/or a company, and the block looks the customer up in
 * Productboard (creating or updating them as needed) before attaching the feedback note.
 */
export default Workflows.defineWorkflowBlock({
    type: "step",
    id: "send-feedback-to-productboard",
    title: "Send feedback",
    description:
        "Send product feedback to Productboard for a person and/or company. Looks up the customer in Productboard and creates or updates them automatically.",
    configSchema: Workflows.ConfigSchema.struct({
        person: Workflows.ConfigSchema.attioRecord().optional(),
        company: Workflows.ConfigSchema.attioRecord().optional(),
        feedback_text: Workflows.ConfigSchema.string(),
        tag: Workflows.ConfigSchema.string().optional(),
    }),
})
