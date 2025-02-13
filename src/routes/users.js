import {
    getUserById,
    getUsers,
    loginUser,
    registerUser,
} from "../controllers/users.js";

import nodemailer from 'nodemailer'; // Importer nodemailer
import mjml from 'mjml';
import User from "../models/users.js"; // Importer mjml
import {Op} from "sequelize";
import {getGame} from "../controllers/games.js";

// Fonction pour générer le template de confirmation
const getConfirmationEmailTemplate = (firstName, confirmationLink) => {
    const mjmlTemplate = `
    <mjml>
      <mj-body background-color="#f4f4f4">
        <!-- Header Section -->
        <mj-section background-color="#ffffff" padding="20px">
          <mj-column width="100%">
            <mj-text align="center" color="#333333" font-size="24px" font-weight="bold" padding="0">Account Confirmation</mj-text>
            <mj-divider border-color="#d1d1d1" border-width="1px" padding-top="10px" padding-bottom="10px"></mj-divider>
          </mj-column>
        </mj-section>

        <!-- Greeting Section -->
        <mj-section background-color="#ffffff" padding="20px">
          <mj-column width="100%">
            <mj-text align="left" color="#333333" font-size="18px" padding="0">Hello ${firstName},</mj-text>
            <mj-text align="left" color="#555555" font-size="16px" padding-top="10px">
              Thank you for creating an account with us. Please confirm your account by clicking the button below:
            </mj-text>
          </mj-column>
        </mj-section>

        <!-- Call to Action Button -->
        <mj-section background-color="#ffffff" padding="20px">
          <mj-column width="100%" vertical-align="middle">
            <mj-button background-color="#4CAF50" color="#ffffff" font-size="18px" font-weight="bold" border-radius="5px" padding="15px 30px" href="${confirmationLink}">
              Confirm My Account
            </mj-button>
          </mj-column>
        </mj-section>

        <!-- Additional Information Section -->
        <mj-section background-color="#ffffff" padding="20px">
          <mj-column width="100%">
            <mj-text align="left" color="#555555" font-size="14px">
              If you did not create an account, please ignore this email. This link will expire in 24 hours.
            </mj-text>
          </mj-column>
        </mj-section>

        <!-- Footer Section -->
        <mj-section background-color="#ffffff" padding="20px">
          <mj-column width="100%">
            <mj-divider border-color="#d1d1d1" border-width="1px" padding-top="10px" padding-bottom="10px"></mj-divider>
            <mj-text align="center" color="#777777" font-size="14px">
              Best regards,<br />The [[CompanyName]] Team
            </mj-text>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>
  `;

    const htmlOutput = mjml(mjmlTemplate);
    return htmlOutput.html;
};

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'rgrange699@gmail.com',
        pass: 'jyev wexz tbjr eyer',
    },
});

export function usersRoutes(app) {
    app.post("/login", async (request, reply) => {
        reply.send(await loginUser(request.body, app));
    }).post(
        "/logout",
        {preHandler: [app.authenticate]},
        async (request, reply) => {
            const token = request.headers["authorization"].split(" ")[1]; // Récupérer le token depuis l'en-tête Authorization

            // Ajouter le token à la liste noire
            blacklistedTokens.push(token);

            reply.send({logout: true});
        }
    );

    // Inscription
    app.post("/register", async (request, reply) => {
        // Créer l'utilisateur (fonction existante)
        const user = await registerUser(request.body, app.bcrypt);

        if (user) {
            const confirmationLink = `http://localhost:3000/confirm?token=${user.confirmationToken}`;

            const emailHtml = getConfirmationEmailTemplate(user.firstName, confirmationLink);

            const mailOptions = {
                from: 'rgrange699@gmail.com',
                to: user.email,
                subject: 'Confirm your account',
                html: emailHtml,
            };

            // Envoyer l'email de confirmation
            await transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log('Error sending confirmation email:', error);
                    reply.status(500).send({message: 'Error sending confirmation email'});
                } else {
                    console.log('Confirmation email sent:', info.response);
                    reply.send({message: 'User registered. Please check your email for confirmation.'});
                }
            });
        } else {
            reply.status(400).send({message: 'User registration failed'});
        }
    });

    app.get("/confirm", async (request, reply) => {
        const {token} = request.query;

        if (!token) {
            return reply.status(400).send({message: 'Token is missing'});
        }

        const user = await User.findOne({
            where: {
                confirmationToken: token,
                confirmationTokenExpires: {
                    [Op.gt]: new Date(), // token doit être encore valide
                }
            }
        });

        if (!user) {
            reply.redirect('http://localhost:5173/expired-token')
        }

        user.verified = true;
        user.confirmationToken = null;
        user.confirmationTokenExpires = null;
        await user.save();

        reply.redirect('http://localhost:5173/confirmation-success')
    });


    //récupération de la liste des utilisateurs
    app.get("/users", async (request, reply) => {
        reply.send(await getUsers());
    });

    //récupération d'un utilisateur par son id
    app.get("/users/:id", async (request, reply) => {
        reply.send(await getUserById(request.params.id));
    });

    //récupération info creator game with game id
    app.get("/users/game/:id", async (request, reply) => {
        const infoGame = await getGame(request.params.id)
        const creator = infoGame.dataValues.creator
        reply.send(await getUserById(creator))
    });
}
