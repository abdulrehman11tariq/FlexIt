const names=[
  "Strongly Agree","Agree","Uncertain","Dissatisfied","Strongly Disagree"
];

const slider=document.getElementById("rating");
const value=document.getElementById("value");
const status=document.getElementById("status");

chrome.storage.local.get({selectedIndex:0}, ({selectedIndex}) => {
  slider.value=selectedIndex;
  value.textContent=names[selectedIndex];
});

slider.addEventListener("input", async () => {
  const i=Number(slider.value);
  value.textContent=names[i];
  await chrome.storage.local.set({selectedIndex:i});
});

document.getElementById("run").addEventListener("click", async () => {
  status.textContent="Running…";
  try {
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if (!tab?.id) throw new Error();
    await chrome.tabs.sendMessage(tab.id,{type:"RUN"});
    status.textContent="Started — you can close this popup.";
  } catch {
    status.textContent="Open the feedback page and try again.";
  }
});