import User from "../models/users.js";
import {Op} from "sequelize";
import CryptoJS from 'crypto-js';

async function generateID(id) {
    const {count} = await findAndCountAllUsersById(id);
    if (count > 0) {
        id = id.substring(0, 5);
        const {count} = await findAndCountAllUsersById(id);
        id = id + (count + 1);
    }
    return id;
}

export async function getUsers() {
    return await User.findAll();
}

export async function getUserById(id) {
    return await User.findByPk(id);
}

export async function findAndCountAllUsersById(id) {
    return await User.findAndCountAll({
        where: {
            id: {
                [Op.like]: `${id}%`,
            },
        },
    });
}

export async function findAndCountAllUsersByEmail(email) {
    return await User.findAndCountAll({
        where: {
            email: {
                [Op.eq]: email,
            },
        },
    });
}

export async function findAndCountAllUsersByUsername(username) {
    return await User.findAndCountAll({
        where: {
            username: {
                [Op.eq]: username,
            },
        },
    });
}

export async function registerUser(userDatas, bcrypt) {
    if (!userDatas) {
        return {error: "Aucune donnée à enregistrer"};
    }
    const {firstname, lastname, username, email, password} = userDatas;
    if (!firstname || !lastname || !username || !email || !password) {
        return {error: "Tous les champs sont obligatoires"};
    }


    const {count: emailCount} = await findAndCountAllUsersByEmail(email);
    if (emailCount > 0) {
        return {error: "L'adresse email est déjà utilisée."};
    }


    const {count: usernameCount} = await findAndCountAllUsersByUsername(username);
    if (usernameCount > 0) {
        return {error: "Le nom d'utilisateur est déjà utilisé."};
    }

    let id = await generateID((lastname.substring(0, 3) + firstname.substring(0, 3)).toUpperCase());


    const confirmationToken = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
    const confirmationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);


    const hashedPassword = await bcrypt.hash(password);


    const user = {
        id,
        firstname,
        lastname,
        username,
        email,
        password: hashedPassword,
        confirmationToken,
        confirmationTokenExpires,
    };
    return await User.create(user);
}

export async function loginUser(userDatas, app) {
    if (!userDatas) {
        return {error: "Aucune donnée n'a été envoyée"};
    }
    const {email, password} = userDatas;
    if (!email || !password) {
        return {error: "Tous les champs sont obligatoires"};
    }

    const {count, rows} = await findAndCountAllUsersByEmail(email);
    if (count === 0) {
        return {
            error: "Il n'y a pas d'utilisateur associé à cette adresse email.",
        };
    } else if (rows[0].verified === false) {
        return {
            error: "Votre compte n'est pas encore vérifié. Veuillez vérifier votre boîte mail.",
        };
    }

    const user = await User.findOne({
        where: {
            email: {
                [Op.eq]: email,
            },
        },
    });

    const match = await app.bcrypt.compare(password, user.password);
    if (!match) {
        return {error: "Mot de passe incorrect"};
    }

    const token = app.jwt.sign(
        {id: user.id, username: user.username},
        {expiresIn: "3h"}
    );
    return {token};
}
