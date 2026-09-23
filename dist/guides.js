(function (root) {
  "use strict";
  const { steps, featureTypes, uiElements } = root.BriefQuestions || require("./questions.js");
  const questions = Object.fromEntries(steps.flatMap(step => step.groups.flatMap(group => group.questions)).map(question => [question.id, question]));
  const help = item => item ? { meaning: item.meaning || item.description, fit: item.fit, avoid: item.avoid } : null;
  function get(question, option) {
    const id = typeof question === "string" ? question : question?.id;
    const value = typeof option === "string" ? option : option?.id || option?.label;
    if (!value || ["아직 미정", "미정"].includes(value)) return null;
    if (id === "features") return help(featureTypes.find(item => item.id === value || item.label === value));
    if (id === "screens" || id === "uiElements") return help(uiElements.find(item => item.id === value || item.label === value));
    return questions[id]?.optionHelp?.[value] || null;
  }
  const api = { get, questions };
  root.BriefGuides = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
