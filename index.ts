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

// Definicion de las maquinas de estados.
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

/*Creacion de una instancia: en Castore se manejan dentro de los comandos
que se ejecutan, utilizando al eventStore relacionado. Luego el eventStore es el
encargado de guardar y administrar los aggregates. Acá tenemos que administrarlos
nosotros mismos.*/
const feedbackActor = createActor(feedbackMachine, {
    inspect: (event) => {
        if (event.type !== "@xstate.event") return
        if (event.event.type === "xstate.init") return

        /*Debo crear manualmente la funcion que guarda los eventos en la bd. Esta
        no solo se debe preocupar de adaptar (como en Castore), sino que también debe
        preocuparse de manejar eventos que tengan dependencias (antes de manejaban con
        pushEventGroup)*/
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


/* Para cambiar el estado de las instancias, debo tomar la instancia en particular y cambiar su estado,
teniendo que manejar manualmente todas las implicancias de este. En Castore estos cambios se hacen 
manteniendo la sincronicidad, debido a las definiciones de los comandos.

Eventualmente podríamos crear un comando para que maneje los cambios de estados de este tipo de 
instancia, sin embargo, no existe un comando de pushEventGroup, por lo que tendríamos que 
recrearlo manualmente.*/
feedbackActor.send({
    type: "ADD_FEEDBACK",
    payload: {
        id: `feedback-${v4()}`,
        feedback: "This is great!",
        authorId: "123",
        subjectId: "456",
    }
})

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
