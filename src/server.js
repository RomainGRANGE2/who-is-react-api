import chalk from "chalk";

import fastify from "fastify";
import fastifyBcrypt from "fastify-bcrypt";
import cors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fastifyJWT from "@fastify/jwt";
import socketioServer from "fastify-socket.io"

import { usersRoutes } from "./routes/users.js";
import { gamesRoutes } from "./routes/games.js";

import { sequelize } from "./bdd.js";


try {
	sequelize.authenticate();
	console.log(chalk.grey("Connecté à la base de données MySQL!"));
} catch (error) {
	console.error("Impossible de se connecter, erreur suivante :", error);
}

/**
 * API
 * avec fastify
 */
let blacklistedTokens = [];
const app = fastify();

await app
	.register(fastifyBcrypt, {
		saltWorkFactor: 12,
	})
	.register(cors, {
		origin: ["https://who-is-react.vercel.app/", "*"],
		methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
		credentials: true
	})
	.register(fastifySwagger, {
		openapi: {
			openapi: "3.0.0",
			info: {
				title: "Documentation de l'API JDR LOTR",
				description:
					"API développée pour un exercice avec React avec Fastify et Sequelize",
				version: "0.1.0",
			},
		},
	})
	.register(fastifySwaggerUi, {
		routePrefix: "/documentation",
		theme: {
			title: "Docs - JDR LOTR API",
		},
		uiConfig: {
			docExpansion: "list",
			deepLinking: false,
		},
		uiHooks: {
			onRequest: function (request, reply, next) {
				next();
			},
			preHandler: function (request, reply, next) {
				next();
			},
		},
		staticCSP: true,
		transformStaticCSP: (header) => header,
		transformSpecification: (swaggerObject, request, reply) => {
			return swaggerObject;
		},
		transformSpecificationClone: true,
	})
	.register(fastifyJWT, {
		secret: "unanneaupourlesgouvernertous",
	})
	.register(socketioServer, {
		cors: {
			origin: "*",
		}
	})
/**********
 * Routes
 **********/
app.get("/", (request, reply) => {
	reply.send({ documentationURL: "http://localhost:3000/documentation" });
});

app.decorate("authenticate", async (request, reply) => {
	try {
		const token = request.headers["authorization"].split(" ")[1];


		if (blacklistedTokens.includes(token)) {
			return reply
				.status(401)
				.send({ error: "Token invalide ou expiré" });
		}
		await request.jwtVerify();
	} catch (err) {
		reply.send(err);
	}
});

usersRoutes(app);

gamesRoutes(app);

/**********
 * START
 **********/

const start = async () => {
	try {
		await sequelize
			.sync({ alter: true })
			.then(() => {
				console.log(chalk.green("Base de données synchronisée."));
			})
			.catch((error) => {
				console.error(
					"Erreur de synchronisation de la base de données :",
					error
				);
			});
		await app.listen({ port: parseInt(process.env.PORT) || 3000, host: '0.0.0.0' });
		console.log(
			"Serveur Fastify lancé sur " + chalk.blue("http://localhost:3000")
		);
		console.log(
			chalk.bgYellow(
				"Accéder à la documentation sur http://localhost:3000/documentation"
			)
		);
	} catch (err) {
		console.log(err);
		process.exit(1);
	}
};

const games = {};

app.io.on("connection", (socket) => {
	console.log("Nouveau joueur connecté:", socket.id);

	socket.on("joinGame", ({ gameId, user }) => {
		if (!games[gameId]) {
			games[gameId] = { players: [], turn: null };
		}

		if (!games[gameId].players.some(player => player.id === user.id)) {
			games[gameId].players.push({ ...user, socketId: socket.id });
		}

		socket.join(gameId);
		console.log(`${user.username} a rejoint la partie ${gameId}`);


		app.io.to(gameId).emit("updatePlayers", games[gameId].players);
		app.io.to(gameId).emit("updateTurn", games[gameId].turn);
	});

	socket.on("startGame", (gameId) => {
		if (games[gameId] && games[gameId].players.length === 2) {

			const firstPlayer = games[gameId].players[Math.floor(Math.random() * 2)];
			games[gameId].turn = firstPlayer.id;

			console.log(`La partie ${gameId} commence. Premier joueur : ${firstPlayer.username}`);

			app.io.to(gameId).emit("gameStarted", true);
			app.io.to(gameId).emit("updateTurn", games[gameId].turn);
		}
	});


	socket.on("askQuestion", ({ gameId, question }) => {
		if (games[gameId]) {
			console.log(`Question posée dans la partie ${gameId} : ${question}`);
			app.io.to(gameId).emit("receiveQuestion", question);
		}
	});


	socket.on("answerQuestion", ({ gameId, answer }) => {
		if (games[gameId]) {
			console.log(`Réponse dans la partie ${gameId} : ${answer}`);
			app.io.to(gameId).emit("receiveAnswer", answer);
		}
	});


	socket.on("endTurn", (gameId) => {
		if (games[gameId]) {
			const currentTurn = games[gameId].turn;
			const nextPlayer = games[gameId].players.find(player => player.id !== currentTurn);
			games[gameId].turn = nextPlayer.id;

			console.log(`Tour terminé. Nouveau tour : ${nextPlayer.username}`);
			app.io.to(gameId).emit("updateTurn", games[gameId].turn);
		}
	});


	socket.on("nextTurn", (gameId) => {
		if (games[gameId]) {
			const currentTurn = games[gameId].turn;
			const nextPlayer = games[gameId].players.find(player => player.id !== currentTurn);
			games[gameId].turn = nextPlayer.id;

			console.log(`Tour de jeu changé. Nouveau tour : ${nextPlayer.username}`);
			app.io.to(gameId).emit("updateTurn", games[gameId].turn);
		}
	});

	socket.on("selectCharacter", ({ gameId, userId, character }) => {
		if (games[gameId]) {
			const player = games[gameId].players.find(p => p.id === userId);
			if (player) {
				player.selectedCharacter = character;
				console.log(`${player.username} a choisi ${character.name}`);


				app.io.to(gameId).emit("updateSelectedCharacters", games[gameId].players);
			}
		}
	});

	socket.on("makeGuess", ({ gameId, userId, guessedCharacter }) => {
		if (games[gameId]) {
			const opponent = games[gameId].players.find(player => player.id !== userId);

			if (opponent && opponent.selectedCharacter.id === guessedCharacter.id) {
				console.log(`🎉 Joueur ${userId} a deviné correctement ! Victoire !`);
				app.io.to(gameId).emit("gameOver", { winnerId: userId, loserId: opponent.id, message: "Bravo ! Vous avez trouvé le bon personnage 🎉" });
			} else {
				console.log(`❌ Joueur ${userId} s'est trompé. Il perd la partie.`);
				app.io.to(gameId).emit("gameOver", { winnerId: opponent.id, loserId: userId, message: "Votre adversaire s'est trompé. Vous avez gagné ! 🏆" });
			}
		}
	});



	socket.on("disconnect", () => {
		console.log("Client déconnecté:", socket.id);

		for (const gameId in games) {
			const playerIndex = games[gameId]?.players.findIndex(player => player.socketId === socket.id);
			if (playerIndex !== -1) {
				const removedPlayer = games[gameId].players.splice(playerIndex, 1)[0];
				console.log(`${removedPlayer.username} a quitté la partie ${gameId}`);

				if (games[gameId].players.length === 0) {
					delete games[gameId];
					console.log(`La partie ${gameId} est supprimée.`);
				}


				if (games[gameId]) {
					app.io.to(gameId).emit("updatePlayers", games[gameId].players);
				}
				break;
			}
		}
	});
});









start();
