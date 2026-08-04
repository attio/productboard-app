import {PersonFeedbackDialog} from "../../record/actions/person-feedback-dialog"

export function CallTranscriptFeedbackDialog({
    selectedText,
    hideDialog,
}: {
    selectedText: string
    transcriptUrl: string
    speakerName?: string
    hideDialog?: () => void
}) {
    return <PersonFeedbackDialog feedbackText={selectedText} hideDialog={hideDialog} />
}
