export const decodeMessage = msg => {
    try {
      if (typeof msg === 'object') {
        return new TextDecoder().decode(msg)
      }
      else return new Error('msg is not a string or object')
    } catch (error) {
      return error
    }
  }
  