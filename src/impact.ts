import zValue from './ztable'
import { State } from './types'
/**
 * Find a confidence interval for the impact of an action on a state
 * @param {*} action 
 * @param {*} stateBefore 
 * @param {*} stateAfter 
 * @param {*} levelOfConfidence 
 * @idea make levelOfConfidence a function of the number of times the action has been taken
 * @idea make levelOfConfidence a function of sentiment
 * @source https://www.investopedia.com/terms/c/confidenceinterval.asp
 */
function impact_confidence(action: number, stateBefore: number, stateAfter: number, levelOfConfidence = 0.95, interpret = false) {
  const diff = stateBefore - stateAfter
  const mean = diff
  const variance = Math.pow(diff, 2)
  const stdDev = Math.sqrt(variance)

  // Calculate the confidence interval
  const z = zValue(levelOfConfidence)

  // find margins of error based on normal distibution
  const marginOfError = z * stdDev / Math.sqrt(1)
  const lowerBound = mean - marginOfError
  const upperBound = mean + marginOfError

  // Output the results
  if (interpret === true) {
    console.log(`Action: ${action}`)
    console.log(`State before: ${stateBefore}`)
    console.log(`State after: ${stateAfter}`)
    console.log(`Mean difference: ${mean}`)
    console.log(`Standard deviation: ${stdDev}`)
    console.log(`Confidence interval (${levelOfConfidence * 100}%): ${lowerBound} to ${upperBound}`)
    console.log("We are " + levelOfConfidence * 100 + "% confident that the impact of " + action + " on the state is between " + lowerBound + " and " + upperBound + ".")
  }
  return { lowerBound, upperBound, levelOfConfidence }
}

export function calc_impact(state: State, action: number) {

  // will return a float between 0 and 1
  // 0 means no impact
  // 1 means the action had a huge impact
  // 0.5 means the action had a neutral impact
  // 0.25 means the action had a small impact
  // 0.75 means the action had a large impact
  return { id:crypto.randomUUID(), impact: Math.random(), confidence: impact_confidence(action, state.before, state.after) }
}