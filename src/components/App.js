import React, { useState, useEffect } from 'react';
import Usage from './editor/Usage';
import Controls from './editor/Controls';
import Breadcrumb from './editor/Breadcrumb';
import MapView from './editor/MapView';
import Meta from './editor/Meta';
import Editor from './editor/Editor';
import {renderSvg} from '../renderSwardley';
import Convert from '../convert';

function App(){

    const apiEndpoint = 'https://s7u91cjmdf.execute-api.eu-west-1.amazonaws.com/dev/maps/';
    let loaded = false;

    const [currentUrl, setCurrentUrl] = useState('');
    const [metaText, setMetaText] = useState('');
    const [mapText, setMapText] = useState('');
    const [mapTitle, setMapTitle] = useState('Untitled Map');

    const setMetaData = () =>{
        var i = $.map($('.draggable'), function (el) {
            return { name: $(el).attr('id'), x: $(el).attr('x'), y: $(el).attr('y') };
        })
        setMetaText(JSON.stringify(i));
    }

    const mutateMapText =  (newText) => {
        setMapText(newText);
    };
    useEffect(() => {
        updateMap(mapText, metaText);
    })
    const updateMap = () => {
        try {
            generateMap(mapText, metaText);
        } catch (e) {
            console.log('Invalid markup, could not render.');
        }
    };

    function NewMap(){
        setMapText('');
        setMetaText('');
        window.location.hash = '';
        setCurrentUrl('(unsaved)');
    }

    function SaveMap(){
        loaded = false;
        setCurrentUrl('(saving...)');
        var hash = window.location.hash.replace("#", "");
        save(hash);
    }

    const save = function(hash) {
        $.ajax({
            type: "POST",
            url: apiEndpoint + "save",
            data: JSON.stringify({ id: hash, text: mapText, meta: metaText }),
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            success: function (data) {
                window.location.hash = '#' + data.id;
                setCurrentUrl(window.location.href);
            },
            failure: function (errMsg) {
                setCurrentUrl('(could not save map, please try again)')
            }
        });
    };

    var selectedElement, offset;

    function getMousePosition(evt) {
        var CTM = document.getElementById('svgMap').getScreenCTM();
        return {
            x: (evt.clientX - CTM.e) / CTM.a,
            y: (evt.clientY - CTM.f) / CTM.d
        };
    }

    var getWidth = function () {
        var textWidth = $('#htmPane').width();
        var width = $(window).width();
        var calcWidth = (width - textWidth - 120);
        return calcWidth;
    };

    //Height is currently fixed to 600.
    const getHeight = () => 600

    function startDrag(evt) {

        var target = evt.currentTarget;
        if (target.nodeName == "tspan") {
            target = target.parentElement;
        }

        if (target.classList.contains('draggable')) {
            selectedElement = target;
            offset = getMousePosition(evt);
            if (target.classList.contains('node')) {
                //set offset against transform x and y values from the SVG element
                const transforms = selectedElement.transform.baseVal.consolidate().matrix;
                offset.x -= transforms.e;
                offset.y -= transforms.f;
            }
            offset.x -= parseFloat(selectedElement.getAttributeNS(null, "x"));
            offset.y -= parseFloat(selectedElement.getAttributeNS(null, "y"));
        }
    }
    //write mouse coords here to update everything in endDrag.
    let coord;
    function drag(evt) {
        if (selectedElement) {
            evt.preventDefault();
            coord = getMousePosition(evt);
            $('tspan', $(selectedElement)).attr('x', coord.x - offset.x);
            if (selectedElement.classList.contains('node')) {
                $(selectedElement).attr("transform", `translate(${coord.x},${coord.y})`);
            } else {
                $(selectedElement).attr("x", coord.x - offset.x).attr("y", coord.y - offset.y);
                setMetaData()
            }
        }
    }

    function endDrag(evt) {
        mutateMapText(
            mapText
                .split("\n")
                .map(line => {
                    if (
                        line
                            .replace(/\s/g, "") //Remove all whitespace from the line in case the user has been abusive with their spaces.
                            //get node name from the rendered text in the map
                            .indexOf(
                                selectedElement
                                    .querySelector("text")
                                    .childNodes[0].nodeValue
                                    .replace(/\s/g, "") + "[" //Ensure that we are at the end of the full component name by checking for a brace
                            ) !== -1
                    ) {
                        //Update the component line in map text with new coord values.
                        //For evolved components, we only update the evolved value
                        if (selectedElement.classList.contains("evolved")) {
                            return line.replace(
                                //Take all characters after the closing brace
                                /\](.+)/g,
                                `] evolve ${(
                                    (1 / getWidth()) * coord.x
                                ).toFixed(2)}`
                            );
                        } else {
                            return line.replace(
                                /\[(.+?)\]/g, //Find everything inside square braces.
                                `[${1 - ((1 / getHeight()) * coord.y).toFixed(
                                        2
                                    )}, ${((1 / getWidth()) * coord.x).toFixed(
                                    2
                                )}]`
                            );
                        }
                    } else {
                        return line;
                    }
                })
                .join("\n")
        );

        setMetaData();
        selectedElement = null;
    }

    function generateMap(txt, meta) {
        loaded = false;
        var r = new Convert().parse(txt);
        setMapTitle(r.title);
        $('#map').html(renderSvg(r, getWidth(), getHeight()));
        $('.draggable').on('mousedown', startDrag)
            .on('mousemove', drag)
            .on('mouseup', endDrag);
        if (meta.length > 0) {
            var items = JSON.parse(meta);
            items.forEach(element => {
                $('#' + element.name).attr('x', element.x).attr('y', element.y);
                $('tspan', $('#' + element.name)).attr('x', element.x);
            });
        }
    };

    React.useEffect(() => {

        function loadMap(){
            setCurrentUrl('(unsaved)');
            generateMap('', '');
            if (window.location.hash.length > 0 & loaded == false) {
                loaded = true;
                setCurrentUrl('(loading...)');
                var fetch = apiEndpoint + "fetch?id=" + window.location.hash.replace("#", "");
                $.getJSON(fetch, function (d) {
                    if (d.meta == undefined || d.meta == null) {
                        d.meta = "";
                    }
                    setMapText(d.text);
                    setMetaText(d.meta);
                    updateMap(d.text, d.meta);
                    setCurrentUrl(window.location.href);
                });
            }
        }
        function handleResize(){
            generateMap(mapText);
        }
        window.addEventListener('resize', handleResize);
        window.addEventListener('load',  loadMap);
    });

    return (
        <React.Fragment>
            <nav className="navbar navbar-dark">
                <div className="container-fluid">
                    <a className="navbar-brand" href="#">
                        <h3>Online Wardley Maps</h3>
                    </a>
                    <div id="controlsMenuControl">
                        <Controls mutateMapText={mutateMapText} newMapClick={NewMap} saveMapClick={SaveMap} />
                    </div>
                </div>
            </nav>

            <Breadcrumb currentUrl={currentUrl} />

            <div className="container-fluid">
                <div className="row">
                    <div className="col">
                        <Editor mapText={mapText} mutateMapText={mutateMapText} />
                        <div className="form-group">
                            <Meta metaText={metaText} />
                            <Usage mapText={mapText} mutateMapText={mutateMapText} />
                        </div>
                    </div>
                    <MapView mapTitle={mapTitle} />
                </div>
            </div>
        </React.Fragment>
    )
}

export default App;
