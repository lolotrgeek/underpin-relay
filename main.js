import { relay } from "./relay.js";

(async () => {
    try {
        await relay()
    } catch (err) {
        console.log('An error occurred:', err)
    }
})()