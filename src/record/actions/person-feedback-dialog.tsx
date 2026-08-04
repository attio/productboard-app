import {Forms, useForm, runQuery} from "attio/client"

import {createLogger} from "../../utils/logger"
import {
    feedbackFormFields,
    handleProductboardSubmit,
    productboardTagComboboxProps,
    showErrorToast,
    showValidationErrorToast,
} from "./feedback-form"
import getPersonDataQuery from "./get-person-data.graphql"
import {parsePersonFromGraphql} from "./parse-graphql-record"

const logger = createLogger("person-feedback-dialog")

const formSchema = {
    person: Forms.attioRecord(),
    ...feedbackFormFields,
}

export function PersonFeedbackDialog({
    feedbackText,
    initialPersonRecordId,
    hideDialog,
}: {
    feedbackText?: string
    initialPersonRecordId?: string
    hideDialog?: () => void
}) {
    const {Form, TextInput, SubmitButton, AttioRecordCombobox, Combobox} = useForm(formSchema, {
        person: initialPersonRecordId
            ? {
                  recordId: initialPersonRecordId,
                  object: "people" as const,
              }
            : undefined,
        feedbackText: feedbackText ?? "",
        tag: undefined,
    })

    return (
        <Form
            onSubmit={async (values) => {
                const trimmedFeedback = values.feedbackText?.trim() ?? ""

                if (trimmedFeedback === "") {
                    await showValidationErrorToast("Feedback text is required.")
                    return
                }

                if (!values.person) {
                    await showValidationErrorToast("Please select a person.")
                    return
                }

                let personData
                try {
                    const result = await runQuery(getPersonDataQuery, {
                        recordId: values.person.recordId,
                    })
                    personData = parsePersonFromGraphql(result.person)

                    if (!personData) {
                        throw new Error("Person record has no name or email")
                    }
                } catch (error) {
                    logger.error("Error getting person data:", error)
                    await showErrorToast(
                        "Failed to load person data from the selected record. Please try again."
                    )
                    return
                }

                await handleProductboardSubmit({
                    sourceLabel: personData.name || personData.email,
                    hideDialog,
                    loadErrorMessage: "Error submitting to Productboard:",
                    params: {
                        personName: personData.name,
                        personEmail: personData.email,
                        feedbackText: trimmedFeedback,
                        tagName: values.tag || undefined,
                    },
                })
            }}
        >
            <AttioRecordCombobox
                label="Person"
                name="person"
                object="people"
                placeholder="Select a person"
            />

            <TextInput label="Feedback" name="feedbackText" />

            <Combobox {...productboardTagComboboxProps} />

            <SubmitButton label="Submit" />
        </Form>
    )
}
