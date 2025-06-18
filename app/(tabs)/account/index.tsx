import { Redirect } from 'expo-router';

/**
 * Account screen component
 * Provides user account management, sync settings, and sign-out functionality
 * 
 * @returns {JSX.Element} Complete account screen with profile and actions
 */
export default function Account() {
    return <Redirect href="/(tabs)/account/profile" />;
}
