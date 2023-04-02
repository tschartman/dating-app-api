const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const crypto = require('crypto')
const sendEmail = require('../utils/email');
const twilio = require('twilio');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function getUserByEmailOrPhone(email, phone) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { phone }],
    },
  });
  return user;
}

async function sendVerificationToken(userId, email, phone) {
  const verificationToken = crypto.randomBytes(4).toString('hex');
  const expiration = new Date();
  expiration.setMinutes(expiration.getMinutes() + 10); // Set the token to expire in 10 minutes

  // Store the token in the database with a reference to the user's ID
  await prisma.verificationToken.create({
    data: {
      token: verificationToken,
      expiration,
      userId,
    },
  });

    if (email) {
      await sendEmail(email, 'Email Verification', `Your verification code is: ${verificationToken}`);
    } else if (phone) {
      await client.messages.create({
        body: `Your verification code is: ${verificationToken}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone,
      });
    }
}

async function verifyPasswordlessToken(email, phone, verificationToken) {
  const user = await getUserByEmailOrPhone(email, phone);

  if (!user) {
    throw new Error('User not found');
  }

  const storedToken = await prisma.verificationToken.findFirst({
    where: {
      userId: user.id,
      token: verificationToken,
    },
  });

  if (!storedToken || storedToken.expiration < new Date()) {
    throw new Error('Invalid or expired verification token');
  }

  // Delete the used token
  await prisma.verificationToken.delete({
    where: {
      id: storedToken.id,
    },
  });

  return user;
}


exports.register = async (req, res) => {
  const { email, phone } = req.body;

  if (!email && !phone) {
    return res.status(400).json({ message: 'Please provide an email or phone number' });
  }

  try {
    const newUser = await prisma.user.create({
      data: {
        email,
        phone,
      },
    });


    await sendVerificationToken(newUser.id, email, phone);

    res.status(201).json({ message: 'User registered successfully', user: newUser });

  } catch (error) {
    res.status(500).json({ message: 'Error registering user', error });
  }
};


exports.login = async (req, res) => {
  const { email, phone } = req.body;

  try {
    const user = await getUserByEmailOrPhone(email, phone);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await sendVerificationToken(user.id, email, phone);

    res.status(200).json({ message: 'Verification token sent' });

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.verifyToken = async (req, res) => {
  const { email, phone, verificationToken } = req.body;

  try {
    const user = await verifyPasswordlessToken(email, phone, verificationToken);

    // Generate a JWT token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Return the token to the client
    res.status(200).json({ token });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
