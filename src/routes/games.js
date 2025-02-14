import {createGame, getAllGame, getGame, updateGame} from "../controllers/games.js";
import {getUserById} from "../controllers/users.js";
export function gamesRoutes(app) {

	app.post(
		"/game",
		{ preHandler: [app.authenticate] },
		async (request, reply) => {
			reply.send(await createGame(request.body.userId));
		}
	);

	app.patch(
		"/game/:action/:gameId",
		{ preHandler: [app.authenticate] },
		async (request, reply) => {
			reply.send(await updateGame(request));
		}
	);

	app.get("/game/:id", async (request, reply) => {
		reply.send(await getGame(request.params.id));
	});

	app.get("/game", async (request, reply) => {
		reply.send(await getAllGame());
	});
}
