import {type AsyncResult, complete, errored, isComplete} from "@attio/fetchable"

import {ProductboardUserError, toProductboardUserError} from "./client/errors"
import {resolveProductboardCustomerEmail} from "./customer-email"
import {productboardClient} from "./index"
import type {CreateNoteParams} from "./submit-productboard-insight.types"

type CustomerParams = Pick<CreateNoteParams, "personName" | "personEmail" | "companyDomain">

function resolveCustomerEmailOrError({
    personEmail,
    companyDomain,
}: Pick<CustomerParams, "personEmail" | "companyDomain">): AsyncResult<
    string,
    ProductboardUserError
> {
    const customerEmail = resolveProductboardCustomerEmail({personEmail, companyDomain})
    if (!customerEmail) {
        return Promise.resolve(
            errored(
                new ProductboardUserError(
                    "No email address or company domain is available to identify a Productboard customer."
                )
            )
        )
    }

    return Promise.resolve(complete(customerEmail))
}

export async function searchProductboardCustomer({
    personEmail,
    companyDomain,
}: Pick<CustomerParams, "personEmail" | "companyDomain">): AsyncResult<
    string | null,
    ProductboardUserError
> {
    const emailResult = await resolveCustomerEmailOrError({personEmail, companyDomain})
    if (!isComplete(emailResult)) return emailResult

    const searchResult = await productboardClient.customers.searchByEmail(emailResult.value)
    if (isComplete(searchResult) && searchResult.value) {
        return complete(searchResult.value)
    }

    return complete(null)
}

export async function createProductboardCustomer({
    personName,
    personEmail,
    companyDomain,
}: CustomerParams): AsyncResult<string, ProductboardUserError> {
    const emailResult = await resolveCustomerEmailOrError({personEmail, companyDomain})
    if (!isComplete(emailResult)) return emailResult

    const customerEmail = emailResult.value
    const createResult = await productboardClient.customers.create({
        email: customerEmail,
        name: personName || undefined,
    })
    if (isComplete(createResult)) {
        return complete(createResult.value)
    }

    // Creation can fail if the customer was created concurrently between the search
    // above and this call — re-check before giving up.
    const recheck = await productboardClient.customers.searchByEmail(customerEmail)
    if (isComplete(recheck) && recheck.value) {
        return complete(recheck.value)
    }

    return errored(
        toProductboardUserError({
            action: "Creating Productboard customer",
            error: createResult.error,
        })
    )
}

export default async function ensureProductboardCustomer(
    params: CustomerParams
): AsyncResult<string, ProductboardUserError> {
    const searchResult = await searchProductboardCustomer(params)
    if (!isComplete(searchResult)) return searchResult
    if (searchResult.value) return complete(searchResult.value)

    return createProductboardCustomer(params)
}
