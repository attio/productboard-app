export const ATTIO_API_BASE_URL = "https://api.attio.com"

/**
 * Absolute URL builders for the Attio REST API.
 */
export const endpoints = {
    api: {
        record: (object: string, recordId: string) =>
            `${ATTIO_API_BASE_URL}/v2/objects/${encodeURIComponent(object)}/records/${encodeURIComponent(recordId)}`,

        callRecording: (callRecordingId: string) =>
            `${ATTIO_API_BASE_URL}/v2/call-recordings/${encodeURIComponent(callRecordingId)}`,

        meeting: (meetingId: string) =>
            `${ATTIO_API_BASE_URL}/v2/meetings/${encodeURIComponent(meetingId)}`,
    },
} as const
