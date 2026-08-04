import {showDialog, Extensions} from "attio/client"

import {CallTranscriptFeedbackDialog} from "../../../call-recording/transcript/call-transcript-feedback-dialog"

export default Extensions.defineExtension({
    type: "call-recording-transcript-text-action",
    id: "send-feedback",
    label: "Send feedback",
    onTrigger: async ({transcript, url}) => {
        // Extract the selected text from the transcript
        const selectedText = transcript.map((segment) => segment.text).join(" ")

        // Extract speaker name from the first segment (assuming all selected segments are from the same speaker)
        const speakerName = transcript.length > 0 ? transcript[0].speaker : ""

        showDialog({
            title: "Send feedback",
            Dialog: ({hideDialog}) => {
                return (
                    <CallTranscriptFeedbackDialog
                        selectedText={selectedText}
                        transcriptUrl={url}
                        speakerName={speakerName}
                        hideDialog={hideDialog}
                    />
                )
            },
        })
    },
})
