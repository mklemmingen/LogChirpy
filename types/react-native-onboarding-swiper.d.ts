declare module 'react-native-onboarding-swiper' {
  import { Component } from 'react';
  import { ViewStyle, TextStyle, ImageSourcePropType } from 'react-native';

  export interface OnboardingProps {
    pages: Page[];
    onDone?: () => void;
    onSkip?: () => void;
    onPageChange?: (index: number) => void;
    NextButtonComponent?: React.ComponentType<any>;
    skipLabel?: string;
    nextLabel?: string;
    showSkip?: boolean;
    showNext?: boolean;
    showDone?: boolean;
    containerStyles?: ViewStyle;
    imageContainerStyles?: ViewStyle;
    titleStyles?: TextStyle;
    subtitleStyles?: TextStyle;
  }

  export interface Page {
    backgroundColor: string;
    image: React.ReactElement;
    title: string;
    subtitle: string;
  }

  export default class Onboarding extends Component<OnboardingProps> {}
}