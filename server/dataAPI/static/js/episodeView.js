function episodePlot(container, data) {
  Flotr.draw(
    container,
    [{
      data: data.data,
      lines: { show: true }
    }],
    {
      grid: { horizontalLines: true, verticalLines: false },
      yaxis: { min: data.minValue - 0.5, max: data.maxValue + 0.5 },
      mouse: { track: true, trackY: false, sensibility: 1, trackFormatter: gUnitsMouseTracker }
    }
  );
  let closeBtn = document.getElementById('closeEpisodeViewBtn');
  closeBtn.addEventListener('click', closeWindow, false);
}

function gUnitsMouseTracker(d) {
  return (d.y + "g");
}

function closeWindow(a) {
  a.originalTarget.removeEventListener('click', closeWindow, false);
  document.getElementById('dayViewContainer').classList.remove('hidden');
  a.originalTarget.parentNode.classList.add('hidden');
}
