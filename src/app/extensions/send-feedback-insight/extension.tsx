import {showDialog, Extensions} from "attio/client"

import {CallTranscriptFeedbackDialog} from "../../../call-recording/transcript/call-transcript-feedback-dialog"

export default Extensions.defineExtension({
    type: "call-recording-insight-text-action",
    id: "send-feedback-insight",
    label: "Send feedback",
    onTrigger: async ({text}) => {
        // Use the plain text for the feedback
        const selectedText = text

        showDialog({
            title: "Send feedback",
            Dialog: ({hideDialog}) => {
                return (
                    <CallTranscriptFeedbackDialog
                        selectedText={selectedText}
                        transcriptUrl="" // Insights don't have a transcript URL
                        speakerName="" // Insights don't have speaker info
                        hideDialog={hideDialog}
                    />
                )
            },
        })
    },
})
