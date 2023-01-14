import {makeRedirectUri, revokeAsync, startAsync} from 'expo-auth-session';
import React, {useEffect, createContext, useContext, useState, ReactNode} from 'react';
import {generateRandom} from 'expo-auth-session/build/PKCE';

import {api} from '../services/api';

const {CLIENT_ID} = process.env;


interface User {
    id: number;
    display_name: string;
    email: string;
    profile_image_url: string;
}

interface AuthContextData {
    user: User;
    isLoggingOut: boolean;
    isLoggingIn: boolean;
    signIn: () => Promise<void>;
    signOut: () => Promise<void>;
}

interface AuthProviderData {
    children: ReactNode;
}

const AuthContext = createContext({} as AuthContextData);

const twitchEndpoints = {
    authorization: 'https://id.twitch.tv/oauth2/authorize',
    revocation: 'https://id.twitch.tv/oauth2/revoke'
};

function AuthProvider({children}: AuthProviderData) {
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [user, setUser] = useState({} as User);
    const [userToken, setUserToken] = useState('');

    // get CLIENT_ID from environment variables

    async function signIn() {
        try {
            setIsLoggingIn(true)

            const REDIRECT_URI = makeRedirectUri({useProxy: true})
            //const REDIRECT_URI = "https://auth.expo.io/@joaoneto7499/streamdata"
            const RESPONSE_TYPE = "token"
            const SCOPE = encodeURI("openid user:read:email user:read:follows")
            const FORCE_VERIFY = true
            const STATE = generateRandom(30)

            const authUrl = twitchEndpoints.authorization +
                `?client_id=${CLIENT_ID}` +
                `&redirect_uri=${REDIRECT_URI}` +
                `&response_type=${RESPONSE_TYPE}` +
                `&scope=${SCOPE}` +
                `&force_verify=${FORCE_VERIFY}` +
                `&state=${STATE}`

            console.log(authUrl)

            const response = await startAsync({authUrl})
            console.log(response)

            if (response.type === "success" && response.params.error != "access_denied") {
                if (response.params.state != STATE) {
                    console.log("Invalid state value")
                    throw new Error("Invalid state value")
                }

                api.defaults.headers.common['Authorization'] = `Bearer ${response.params.access_token}`;

                const userResponse = await api.get('/users');

                setUserToken(response.params.access_token)

                const userData = {
                    id: userResponse.data.data[0].id,
                    display_name: userResponse.data.data[0].display_name,
                    email: userResponse.data.data[0].email,
                    profile_image_url: userResponse.data.data[0].profile_image_url
                }

                console.log(userData)

                setUser(userData)
            }

        } catch (error) {
            console.log(error)
            throw new Error("Falha no Login")
        } finally {
            setIsLoggingIn(false)
        }
    }

    async function signOut() {
        try {
            setIsLoggingOut(true)

            await revokeAsync({token: userToken, clientId: CLIENT_ID}, {revocationEndpoint: twitchEndpoints.revocation})
        } catch (error) {
            console.log(error)
            throw new Error("Falha no LogOut")
        } finally {
            setUser({} as User)
            setUserToken("")
            delete api.defaults.headers.common['Authorization'];
            setIsLoggingOut(false)
        }
    }

    useEffect(() => {
        if (CLIENT_ID) {
            api.defaults.headers.common['Client-Id'] = CLIENT_ID;
        } else {
            throw new Error('Twitch CLIENT_ID not defined')
        }
    }, [])

    return (
        <AuthContext.Provider value={{user, isLoggingOut, isLoggingIn, signIn, signOut}}>
            {children}
        </AuthContext.Provider>
    )
}

function useAuth() {
    const context = useContext(AuthContext);

    return context;
}

export {AuthProvider, useAuth};
