import { createMachine, createActor, assign } from "xstate"
import { v4 } from "uuid"

let currentSnapshot: Feedback | undefined
let xstateSnapshot: any
let events: any[] = []

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

        // store event, saving the event is up to us
        events.push({
            eventStoreId: 'FEEDBACK',
            event: event.event.type,
            payload: event.event.payload,
            timestamp: new Date(),
        })
    },
})
feedbackActor.subscribe({
    next: (snapshot) => {
        currentSnapshot = snapshot.context
        xstateSnapshot = snapshot
    }
})
feedbackActor.start()


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

console.log("currentSnapshot first actor", currentSnapshot)
console.log("events", events)

// Send acts like a command for only one entity at a time
// Can't handle business logic about an event

// recreate a second actor from events
const feedbackActor2 = createActor(feedbackMachine)
feedbackActor2.start()

// replay events
events.forEach(event => {
    feedbackActor2.send({
        type: event.event,
        payload: event.payload,
    })
})

feedbackActor2.stop()
console.log("currentSnapshot second actor", feedbackActor2.getPersistedSnapshot())

// recreate a third actor from a snapshot
// can't recreate an actor without an xstate snapshot
const feedbackActor3 = createActor(feedbackMachine, {
    snapshot: xstateSnapshot,
})
console.log("currentSnapshot third actor", feedbackActor3.getPersistedSnapshot())

// for every aggregate we need to create a new actor
// every state machine is not that lightweight and shouldn't be used for every aggregate
