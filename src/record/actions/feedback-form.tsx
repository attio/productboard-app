import {isErrored} from "@attio/fetchable"
import {Forms, showToast} from "attio/client"

import {ProductboardNoteNotLinkedError} from "../../productboard/client/user-errors"
import {resolveProductboardCustomerEmail} from "../../productboard/customer-email"
import submitProductboardInsight from "../../productboard/create-note.server"
import retryPendingNoteLinkByNoteId from "../../productboard/retry-pending-note-link.server"
import type {
    CreateNoteParams,
    ProductboardSubmitPhase,
} from "../../productboard/submit-productboard-insight.types"
import {createLogger} from "../../utils/logger"
import {productboardTagsOptionsProvider} from "./productboard-tags-options-provider"

const logger = createLogger("feedback-form")

const ERROR_TOAST_DURATION_MS = 8000
const SUCCESS_TOAST_DURATION_MS = 5000
const LINK_POLL_INTERVAL_MS = 5000
const LINK_POLL_MAX_ATTEMPTS = 8

export const feedbackFormFields = {
    feedbackText: Forms.string().multiline(),
    tag: Forms.string().optional(),
}

export const productboardTagComboboxProps = {
    label: "Tag",
    name: "tag" as const,
    options: productboardTagsOptionsProvider,
    placeholder: "Select a tag...",
    searchPlaceholder: "Type to search tags",
    decorated: false as const,
}

const PROGRESS_TOAST_COPY: Record<ProductboardSubmitPhase, string> = {
    "finding-contact": "Finding contact in Productboard…",
    "creating-note": "Creating note…",
    "linking-contact": "Linking note to contact…",
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function pollPendingNoteLink(noteId: string): Promise<boolean> {
    for (let attempt = 0; attempt < LINK_POLL_MAX_ATTEMPTS; attempt++) {
        if (attempt > 0) {
            await sleep(LINK_POLL_INTERVAL_MS)
        }

        const retryResult = await retryPendingNoteLinkByNoteId({noteId})
        if (isErrored(retryResult)) {
            return false
        }

        if (retryResult.value.linked) {
            return true
        }
    }

    return false
}

export async function showValidationErrorToast(text: string): Promise<void> {
    await showToast({
        title: "Validation Error",
        variant: "error",
        text,
        durationMs: ERROR_TOAST_DURATION_MS,
    })
}

export async function showErrorToast(text: string, title = "Error"): Promise<void> {
    await showToast({
        title,
        variant: "error",
        text,
        durationMs: ERROR_TOAST_DURATION_MS,
    })
}

export async function handleProductboardSubmit({
    params,
    sourceLabel,
    hideDialog,
    loadErrorMessage,
}: {
    params: CreateNoteParams
    sourceLabel: string
    hideDialog?: () => void
    loadErrorMessage?: string
}): Promise<void> {
    hideDialog?.()

    const initialPhase: ProductboardSubmitPhase = resolveProductboardCustomerEmail({
        personEmail: params.personEmail,
        companyDomain: params.companyDomain,
    })
        ? "finding-contact"
        : "creating-note"

    const {updateToast} = await showToast({
        variant: "neutral",
        title: "Sending to Productboard",
        text: PROGRESS_TOAST_COPY[initialPhase],
        dismissable: false,
        durationMs: Number.POSITIVE_INFINITY,
    })

    const showProgress = async (phase: ProductboardSubmitPhase) => {
        await updateToast({
            text: PROGRESS_TOAST_COPY[phase],
            dismissable: false,
            durationMs: Number.POSITIVE_INFINITY,
        })
    }

    try {
        const result = await submitProductboardInsight(params, {
            onProgress: showProgress,
            deferLinkOnFailure: true,
        })

        if (isErrored(result)) {
            const noteNotLinked = result.error instanceof ProductboardNoteNotLinkedError
            const noteUrl =
                noteNotLinked && result.error instanceof ProductboardNoteNotLinkedError
                    ? result.error.noteUrl
                    : undefined

            await updateToast({
                variant: "error",
                title: noteNotLinked ? "Note not linked" : "Error",
                text: result.error.message,
                dismissable: true,
                durationMs: ERROR_TOAST_DURATION_MS,
                action:
                    noteNotLinked && noteUrl
                        ? {
                              label: "View Note",
                              onClick: () => {
                                  window.open(noteUrl, "_blank")
                              },
                          }
                        : undefined,
            })
            return
        }

        if (result.value.linkPending) {
            await updateToast({
                variant: "neutral",
                title: "Sending to Productboard",
                text: "Feedback saved. Linking contact in Productboard…",
                dismissable: false,
                durationMs: Number.POSITIVE_INFINITY,
            })

            const linked = await pollPendingNoteLink(result.value.id)

            if (!linked) {
                await updateToast({
                    variant: "neutral",
                    title: "Note saved",
                    text: `Feedback from ${sourceLabel} was saved in Productboard, but the contact could not be linked yet.`,
                    dismissable: true,
                    durationMs: SUCCESS_TOAST_DURATION_MS,
                    action: result.value.url
                        ? {
                              label: "View Note",
                              onClick: () => {
                                  window.open(result.value.url, "_blank")
                              },
                          }
                        : undefined,
                })
                return
            }
        }

        await updateToast({
            variant: "success",
            title: "Sent to Productboard",
            text: `Feedback from ${sourceLabel} has been sent to Productboard.`,
            dismissable: true,
            durationMs: SUCCESS_TOAST_DURATION_MS,
            action: result.value.url
                ? {
                      label: "View Note",
                      onClick: () => {
                          window.open(result.value.url, "_blank")
                      },
                  }
                : undefined,
        })
    } catch (error) {
        logger.error(loadErrorMessage ?? "Error submitting to Productboard:", error)
        await updateToast({
            variant: "error",
            title: "Error",
            text:
                error instanceof Error
                    ? error.message
                    : "Failed to submit feedback to Productboard. Please try again.",
            dismissable: true,
            durationMs: ERROR_TOAST_DURATION_MS,
        })
    }
}
