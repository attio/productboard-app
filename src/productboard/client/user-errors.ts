export class ProductboardUserError extends Error {
    constructor(
        message: string,
        readonly status?: number,
        readonly code?: string,
        readonly title?: string,
        readonly detail?: string
    ) {
        super(message)
        this.name = "ProductboardUserError"
    }
}

export class ProductboardNoteNotLinkedError extends ProductboardUserError {
    constructor(
        readonly noteUrl?: string,
        readonly noteId?: string,
        readonly customerEmail?: string
    ) {
        super(
            "Your feedback was saved in Productboard but the note could not be linked to the user."
        )
        this.name = "ProductboardNoteNotLinkedError"
    }
}
