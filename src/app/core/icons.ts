import { addIcons } from 'ionicons';
import {
  addOutline, add, airplaneOutline, alertCircle, alertCircleOutline, arrowDown, arrowUp, bagHandleOutline, barChartOutline,
  briefcaseOutline, businessOutline, calendarOutline, cardOutline, carOutline, cashOutline, checkmark, checkmarkCircle,
  checkmarkCircleOutline, chevronBack, chevronDown, chevronForward, closeOutline, close, cloudDownloadOutline,
  cloudUploadOutline, colorPaletteOutline, createOutline, documentTextOutline, downloadOutline, ellipsisHorizontal,
  ellipsisHorizontalCircleOutline, eyeOffOutline, eyeOutline, fileTrayOutline, filterOutline, fingerPrintOutline,
  flagOutline, gameControllerOutline, giftOutline, gridOutline, heartOutline, helpCircleOutline, homeOutline,
  informationCircle, informationCircleOutline, laptopOutline, leafOutline, listOutline, lockClosedOutline,
  logOutOutline, mailOutline, medkitOutline, moonOutline, notificationsOutline, optionsOutline, pawOutline,
  personCircleOutline, personOutline, phonePortraitOutline, pieChartOutline, pricetagOutline, receiptOutline,
  refreshOutline, removeOutline, repeatOutline, restaurantOutline, returnDownBackOutline, schoolOutline, scanOutline,
  searchOutline, shieldCheckmarkOutline, sparklesOutline, statsChartOutline, sunnyOutline, swapVerticalOutline,
  timeOutline, trashOutline, trendingDown, trendingDownOutline, trendingUp, trendingUpOutline, tvOutline,
  walletOutline, warning, warningOutline, shirtOutline, fitnessOutline, cafeOutline, busOutline, wifiOutline,
  flashOutline, waterOutline, musicalNotesOutline, bookOutline, constructOutline, globeOutline, keyOutline,
  ribbonOutline, rocketOutline, starOutline, trophyOutline, umbrellaOutline, diamondOutline, closeCircle,
  checkmarkDoneOutline, analyticsOutline, peopleOutline, chatbubbleEllipsesOutline, starHalfOutline, shareOutline, settingsOutline, pencilOutline, contrastOutline, phonePortrait, documentOutline, closeCircleOutline, arrowUpOutline, arrowDownOutline, layersOutline, cameraOutline, lockOpenOutline, desktopOutline, exitOutline,
} from 'ionicons/icons';

export function registerIcons(): void {
  addIcons({
    addOutline, add, airplaneOutline, alertCircle, alertCircleOutline, arrowDown, arrowUp, bagHandleOutline, barChartOutline,
    briefcaseOutline, businessOutline, calendarOutline, cardOutline, carOutline, cashOutline, checkmark, checkmarkCircle,
    checkmarkCircleOutline, chevronBack, chevronDown, chevronForward, closeOutline, close, cloudDownloadOutline,
    cloudUploadOutline, colorPaletteOutline, createOutline, documentTextOutline, downloadOutline, ellipsisHorizontal,
    ellipsisHorizontalCircleOutline, eyeOffOutline, eyeOutline, fileTrayOutline, filterOutline, fingerPrintOutline,
    flagOutline, gameControllerOutline, giftOutline, gridOutline, heartOutline, helpCircleOutline, homeOutline,
    informationCircle, informationCircleOutline, laptopOutline, leafOutline, listOutline, lockClosedOutline,
    logOutOutline, mailOutline, medkitOutline, moonOutline, notificationsOutline, optionsOutline, pawOutline,
    personCircleOutline, personOutline, phonePortraitOutline, pieChartOutline, pricetagOutline, receiptOutline,
    refreshOutline, removeOutline, repeatOutline, restaurantOutline, returnDownBackOutline, schoolOutline, scanOutline,
    searchOutline, shieldCheckmarkOutline, sparklesOutline, statsChartOutline, sunnyOutline, swapVerticalOutline,
    timeOutline, trashOutline, trendingDown, trendingDownOutline, trendingUp, trendingUpOutline, tvOutline,
    walletOutline, warning, warningOutline, shirtOutline, fitnessOutline, cafeOutline, busOutline, wifiOutline,
    flashOutline, waterOutline, musicalNotesOutline, bookOutline, constructOutline, globeOutline, keyOutline,
    ribbonOutline, rocketOutline, starOutline, trophyOutline, umbrellaOutline, diamondOutline, closeCircle,
    checkmarkDoneOutline, analyticsOutline, peopleOutline, chatbubbleEllipsesOutline, starHalfOutline, shareOutline, settingsOutline, pencilOutline, contrastOutline, phonePortrait, documentOutline, closeCircleOutline, arrowUpOutline, arrowDownOutline, layersOutline, cameraOutline, lockOpenOutline, desktopOutline, exitOutline,
  });
}

/** Ícones disponíveis para categorias / contas / metas criadas pelo usuário */
export const PICKABLE_ICONS = [
  'home-outline', 'restaurant-outline', 'car-outline', 'medkit-outline', 'school-outline', 'tv-outline',
  'game-controller-outline', 'bag-handle-outline', 'leaf-outline', 'sparkles-outline', 'paw-outline', 'gift-outline',
  'shirt-outline', 'fitness-outline', 'cafe-outline', 'bus-outline', 'wifi-outline', 'flash-outline', 'water-outline',
  'musical-notes-outline', 'book-outline', 'construct-outline', 'globe-outline', 'airplane-outline', 'laptop-outline',
  'briefcase-outline', 'cash-outline', 'trending-up-outline', 'shield-checkmark-outline', 'heart-outline',
  'rocket-outline', 'star-outline', 'trophy-outline', 'umbrella-outline', 'diamond-outline', 'key-outline',
  'phone-portrait-outline', 'business-outline', 'wallet-outline', 'card-outline', 'people-outline', 'pricetag-outline',
];

export const PICKABLE_COLORS = [
  'moradia', 'alimentacao', 'transporte', 'saude', 'educacao', 'assinaturas', 'lazer', 'compras', 'salario', 'extra',
  'reembolso', 'rendimentos', 'outros',
] as const;

export function catColor(color: string): string {
  return `var(--mf-category-${color})`;
}
