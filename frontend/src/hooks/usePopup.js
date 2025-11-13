import { useState } from 'react';

/**
 * usePopup Hook
 * Manages popup modal state and display
 * 
 * @returns {Object} { showPopup, hidePopup, popupData }
 */
export const usePopup = () => {
  const [popupData, setPopupData] = useState(null);

  const showPopup = (data) => {
    setPopupData({
      ...data,
      timestamp: new Date().toISOString(),
    });
  };

  const hidePopup = () => {
    setPopupData(null);
  };

  return {
    showPopup,
    hidePopup,
    popupData,
  };
};

