export type CreateNoteParams = {
    personName: string
    personEmail: string
    companyName?: string
    companyDomain?: string
    feedbackText: string
    featureId?: string
    tagName?: string
}

export type ProductboardSubmitPhase = "finding-contact" | "creating-note" | "linking-contact"

export type ProductboardNoteResult = {
    id: string
    url?: string
    linkPending?: boolean
    isNoteLinked?: boolean
}

export type SubmitProductboardInsightOptions = {
    onProgress?: (phase: ProductboardSubmitPhase) => void | Promise<void>
    /** When true, a failed customer link is queued for background retry instead of failing the submit. */
    deferLinkOnFailure?: boolean
    /** When true, customer link failures are ignored and the created note is returned. */
    ignoreLinkFailure?: boolean
    /** Fixed-interval retries for customer linking (used with ignoreLinkFailure). */
    fixedLinkRetry?: {
        intervalMs: number
        maxDurationMs: number
    }
}
