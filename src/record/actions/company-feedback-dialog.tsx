import {Forms, useForm, runQuery} from "attio/client"

import {createLogger} from "../../utils/logger"
import {
    feedbackFormFields,
    handleProductboardSubmit,
    productboardTagComboboxProps,
    showErrorToast,
    showValidationErrorToast,
} from "./feedback-form"
import getCompanyDataQuery from "./get-company-data.graphql"
import {parseCompanyFromGraphql} from "./parse-graphql-record"

const logger = createLogger("company-feedback-dialog")

const formSchema = {
    company: Forms.attioRecord(),
    ...feedbackFormFields,
}

export function CompanyFeedbackDialog({
    feedbackText,
    initialCompanyRecordId,
    hideDialog,
}: {
    feedbackText?: string
    initialCompanyRecordId?: string
    hideDialog?: () => void
}) {
    const {Form, TextInput, SubmitButton, AttioRecordCombobox, Combobox} = useForm(formSchema, {
        company: initialCompanyRecordId
            ? {
                  recordId: initialCompanyRecordId,
                  object: "companies" as const,
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

                if (!values.company) {
                    await showValidationErrorToast("Please select a company.")
                    return
                }

                let companyData
                try {
                    const result = await runQuery(getCompanyDataQuery, {
                        recordId: values.company.recordId,
                    })
                    companyData = parseCompanyFromGraphql(result.company)

                    if (!companyData) {
                        throw new Error("Company record has no name or domain")
                    }
                } catch (error) {
                    logger.error("Error getting company data:", error)
                    await showErrorToast(
                        "Failed to load company data from the selected record. Please try again."
                    )
                    return
                }

                await handleProductboardSubmit({
                    sourceLabel: companyData.name || companyData.domain,
                    hideDialog,
                    loadErrorMessage: "Error submitting to Productboard:",
                    params: {
                        personName: companyData.name || "",
                        personEmail: "",
                        companyName: companyData.name || "",
                        companyDomain: companyData.domain || undefined,
                        feedbackText: trimmedFeedback,
                        tagName: values.tag || undefined,
                    },
                })
            }}
        >
            <AttioRecordCombobox
                label="Company"
                name="company"
                object="companies"
                placeholder="Select a company"
            />

            <TextInput label="Feedback" name="feedbackText" />

            <Combobox {...productboardTagComboboxProps} />

            <SubmitButton label="Submit" />
        </Form>
    )
}
