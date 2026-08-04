import listProductboardTagsImpl from "../../productboard/list-tags.server"

export type {ProductboardTag} from "../../productboard/types"

export default async function getProductboardTags() {
    return listProductboardTagsImpl()
}
