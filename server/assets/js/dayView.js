const serverURL = "http://192.168.0.23:8088";
function generateTimeTicks(year, month, day) {
  let timeTicks = [];
  for (var h = 0; h < 7; h++) {
    let date = new Date(year, month, day, h * 4);
    timeTicks.push([date.getTime(), date.toTimeString().slice(0, 5)]);
  }
  return timeTicks;
}

function dayPlot(container, data) {
  let dateAsMoment = moment(new Date(data.date));
  document.getElementById("dateInfoDay").innerText = dateAsMoment.format("D MMMM YYYY");
  dateAsMoment.startOf('day');
  const timeTicks = generateTimeTicks(dateAsMoment.year(), dateAsMoment.month(), dateAsMoment.date());
  let minTick = parseInt(dateAsMoment.subtract(2, 'hours').format('x'));
  let maxTick = parseInt(dateAsMoment.add(28, 'hours').format('x'));
  Flotr.draw(
    container,
    [{
      data: data.data,
      bars: {
        show: true,
        barWidth: 0.1
      }
    }],
    {
      grid: { horizontalLines: false, verticalLines: true },
      xaxis: { min: minTick, max: maxTick, ticks: timeTicks },
      yaxis: { min: 0 },
      mouse: { track: true, trackY: false, sensibility: 2, trackFormatter: customMouseTracker }
    }
  );

  // There must be a better/more elegant way to do this, but until then, this hack works
  Flotr.EventAdapter.observe(container, 'flotr:mousemove', function (e, pos, obj) {
    let infoBox = container.getElementsByClassName("flotr-mouse-value")[0];
    if (infoBox === undefined || infoBox.style.display == 'none') {
      obj.el.style.cursor = null;
    }
  });

  Flotr.EventAdapter.observe(container, 'flotr:hit', function (pos, obj) {
    obj.el.style.cursor = 'pointer';
  });

  Flotr.EventAdapter.observe(container, 'flotr:click', function (pos, obj) {
    if (pos.hit === undefined) {
      return;
    }
    gotoEpisodeView(obj.data[0].data[pos.hit.index][0], obj.el);
  });
}

function customMouseTracker(d) {
  let moment = new Date(d.series.data[d.index][0]);
  return (moment.toTimeString().slice(0, 5) + ", " + d.y + " s");
}

function gotoEpisodeView(episodeTimestamp, container) {
  if (!document.getElementById('episodeViewContainer').classList.toggle('hidden')) {
    let data = { maxValue: 0, minValue: 0, data: [] };
    let dateAsMoment = moment(new Date(episodeTimestamp));
    document.getElementById("dateInfoEpisode").innerHTML = dateAsMoment.format("D MMMM YYYY, HH:mm");
    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        data.maxValue = Math.max(...xhr.response.data);
        data.minValue = Math.min(...xhr.response.data);
        // Omit the two last elements which are the separator
        for (let index = 0; index < xhr.response.data.length - 2; index++) {
          data.data.push([index, xhr.response.data[index]]);
        }
        episodePlot(document.getElementById('episodeView'), data);
        container.parentNode.classList.add('hidden');
      }
    };
    xhr.open("GET", serverURL + "/event?timestamp=" + episodeTimestamp / 1000);
    xhr.responseType = "json";
    xhr.send();
  }
}

function dateChanged(e) {
  var day = moment(e.target.value);
  let data = { date: day.toDate(), data: [] };
  day.startOf('day');
  const start = day.unix();
  const stop = day.add(1, 'd').unix();
  fetchDayData(data, start, stop);
}

function fetchDayData(data, start, stop) {
  const xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function () {
    if (this.readyState == 4 && this.status == 200) {
      xhr.response.events.forEach(event => {
        data.data.push([event.timestamp * 1000, event.data.length / 100]);
      });
      dayPlot(document.getElementById('dayView'), data);
    }
  };
  xhr.open("GET", serverURL + "/data?start=" + start + "&stop=" + stop);
  xhr.responseType = "json";
  xhr.send();
}
