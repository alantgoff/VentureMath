import { createContext, useContext } from 'react'

// Lets any printed formula hand itself to the Calc page without every
// component in between having to know the calculator exists.
export const CalcContext = createContext(null)

export const useCalc = () => useContext(CalcContext)
