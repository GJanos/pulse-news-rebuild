import React from 'react';

export const GestureHandlerRootView = require('react-native').View;
export const GestureDetector = ({ children }: { children: React.ReactNode }) => children;
export const Gesture = {
  Pan: () => ({
    activeOffsetX: function (this: unknown) {
      return this;
    },
    failOffsetY: function (this: unknown) {
      return this;
    },
    onStart: function (this: unknown) {
      return this;
    },
    onUpdate: function (this: unknown) {
      return this;
    },
    onEnd: function (this: unknown) {
      return this;
    },
  }),
};
