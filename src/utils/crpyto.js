const crypto = require('crypto')

exports.generateNumericToken = (length) => {
  let token = '';
  const maxRandomValue = 10; // 10 possible digits (0-9)

  while (token.length < length) {
    // Generate random bytes
    const buf = crypto.randomBytes(length);

    // Iterate through the random bytes and add digits to the token
    for (let i = 0; i < buf.length && token.length < length; i++) {
      const randomNumber = buf.readUInt8(i) % maxRandomValue;
      token += randomNumber.toString();
    }
  }

  return token;
}