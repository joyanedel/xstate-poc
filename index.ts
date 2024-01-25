import { createMachine, createActor, assign } from "xstate"
import { v4 } from "uuid"
import { saveSnapshotInDB, storeInDB } from "./db"

interface FeedbackComment {
    authorId: string
    comment: string
}

interface Feedback {
    id: string
    authorId: string
    subjectId: string
    feedback: string
    comments: FeedbackComment[]
}

// Define the state machine
const feedbackMachine = createMachine({
    id: "feedback",
    initial: "NO_FEEDBACK",
    context: {} as Feedback,
    states: {
        NO_FEEDBACK: {
            on: {
                ADD_FEEDBACK: {
                    target: "SUBMITTED",
                    actions: assign({
                        id: ({event: { payload }}) => payload.id,
                        feedback: ({event: { payload }}) => payload.feedback,
                        authorId: ({event: { payload }}) => payload.authorId,
                        subjectId: ({event: { payload }}) => payload.subjectId,
                        comments: [],
                    }),
                },
            },
        },
        SUBMITTED: {
            on: {
                APPROVE: "APPROVED",
                REJECT: "REJECTED",
            },
        },
        APPROVED: {
            on: {
                ADD_COMMENT: {
                    actions: assign({
                        comments: ({context, event: { payload }}) => [...context.comments, payload.comment],
                    }),
                },
            },
        },
        REJECTED: {},
    },
})

// Create the actor
const feedbackActor = createActor(feedbackMachine, {
    inspect: (event) => {
        if (event.type !== "@xstate.event") return
        if (event.event.type === "xstate.init") return

        storeInDB(event.event)
    },
})
feedbackActor.subscribe({
    next: (snapshot) => {
        saveSnapshotInDB(snapshot)
    }
})
feedbackActor.start()

const feedbackActor2 = createActor(feedbackMachine, {
    inspect: (event) => {
        if (event.type !== "@xstate.event") return
        if (event.event.type === "xstate.init") return

        storeInDB(event.event)
    }
})
feedbackActor2.subscribe({
    next: (snapshot) => {
        saveSnapshotInDB(snapshot)
    }
})
feedbackActor2.start()


// Submit feedback
feedbackActor.send({
    type: "ADD_FEEDBACK",
    payload: {
        id: `feedback-${v4()}`,
        feedback: "This is great!",
        authorId: "123",
        subjectId: "456",
    }
})

// Approve feedback
feedbackActor.send({
    type: "APPROVE",
})

feedbackActor.send({
    type: "ADD_COMMENT",
    payload: {
        comment: {
            authorId: "789",
            comment: "I agree!",
        },
    }
})
feedbackActor.stop()
feedbackActor2.stop()
