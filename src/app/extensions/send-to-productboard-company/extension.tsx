import {showDialog, runQuery, showToast, Extensions} from "attio/client"

import {createLogger} from "../../../utils/logger"
import getCompanyDataQuery from "../../../record/actions/get-company-data.graphql"
import {CompanyFeedbackDialog} from "../../../record/actions/company-feedback-dialog"
import {parseCompanyFromGraphql} from "../../../record/actions/parse-graphql-record"

const logger = createLogger("send-to-productboard-company")

export default Extensions.defineExtension({
    type: "record-action",
    id: "send-to-productboard-company",
    label: "Send feedback",
    objects: "companies",
    onTrigger: async ({recordId}) => {
        try {
            const result = await runQuery(getCompanyDataQuery, {recordId})
            const company = parseCompanyFromGraphql(result.company)

            if (!company) {
                await showToast({
                    variant: "error",
                    title: "Company not found",
                    durationMs: 8000,
                })
                return
            }

            showDialog({
                title: "Send feedback",
                Dialog: ({hideDialog}) => (
                    <CompanyFeedbackDialog
                        feedbackText=""
                        initialCompanyRecordId={recordId}
                        hideDialog={hideDialog}
                    />
                ),
            })
        } catch (error) {
            logger.error("Error loading company data:", error)
            await showToast({
                variant: "error",
                title: "Error",
                text: "Failed to load company data. Please try again.",
                durationMs: 8000,
            })
        }
    },
})
