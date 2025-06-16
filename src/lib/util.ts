export const formatSeconds = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const secondsRemainder = Math.floor(seconds % 60);
  return `${minutes}:${
    secondsRemainder < 10 ? `0${secondsRemainder}` : secondsRemainder
  }`;
};
