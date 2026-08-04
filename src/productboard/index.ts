import {createCustomersApi} from "./customers/api"
import {createFeaturesApi} from "./features/api"
import {createNotesApi} from "./notes/api"
import {createTagsApi} from "./tags/api"

export const productboardClient = {
    get customers() {
        return createCustomersApi()
    },
    get features() {
        return createFeaturesApi()
    },
    get notes() {
        return createNotesApi()
    },
    get tags() {
        return createTagsApi()
    },
}
