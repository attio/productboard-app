import {Workflows} from "attio/client"

import {productboardTagsOptionsProvider} from "../../../record/actions/productboard-tags-options-provider"
import block from "./block"

export default Workflows.defineConfigurator(block, (workflowBlock) => {
    const {AttioRecordInput, TextInput, ComboboxInput, Outcome} =
        Workflows.useConfigurator(workflowBlock)

    return (
        <>
            <AttioRecordInput name="person" label="Person" objectSlug="people" />

            <AttioRecordInput name="company" label="Company" objectSlug="companies" />

            <TextInput name="feedback_text" label="Feedback" placeholder="The feedback to send" />

            <ComboboxInput
                name="tag"
                label="Tag"
                placeholder="Select a tag..."
                searchPlaceholder="Type to search tags"
                options={productboardTagsOptionsProvider}
            />

            <Outcome
                id="success"
                schema={{
                    note_id: Workflows.OutcomeSchema.string().title("Note ID"),
                    note_url: Workflows.OutcomeSchema.string().title("Note URL"),
                    is_note_linked: Workflows.OutcomeSchema.boolean().title("Is note linked"),
                }}
            />
        </>
    )
})
