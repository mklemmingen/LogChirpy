import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Optionally import the services that you want to use
// import {...} from 'firebase/auth';
// import {...} from 'firebase/database';
// import {...} from 'firebase/firestore';
// import {...} from 'firebase/functions';
// import {...} from 'firebase/storage';

const firebaseConfig = {
    apiKey: "AIzaSyB1-R1Xd4LJIKbM5IOs6JJZXeF1Y7Paq2A",
    authDomain: "logchirpy.firebaseapp.com",
    projectId: "logchirpy",
    storageBucket: "logchirpy.firebasestorage.app",
    messagingSenderId: "448989343879",
    appId: "1:448989343879:web:d6a6492352f787eec50822",
    measurementId: "G-PLEGFD5HKW"
};


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
// For more information on how to access Firebase in your project,
// see the Firebase documentation: https://firebase.google.com/docs/web/setup#access-firebase
