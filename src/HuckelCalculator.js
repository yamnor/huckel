import React, { useState, useRef, useEffect } from "react";
import * as math from "mathjs";

// Constants
const ATOM_SIZE = 20;
const MAX_ORBITAL_RADIUS_FACTOR = 3;
const ENERGY_DIAGRAM_HEIGHT = 280;
const ENERGY_DIAGRAM_PADDING = 0.1;
const ENERGY_LINE_WIDTH = 80;
const ENERGY_LINE_SPACING = 15;

const HuckelCalculator = () => {
  // State management
  const [atoms, setAtoms] = useState([]);
  const [bonds, setBonds] = useState([]);
  const [selectedAtom, setSelectedAtom] = useState(null);
  const [draggingAtom, setDraggingAtom] = useState(null);
  const [results, setResults] = useState(null);
  const [mode, setMode] = useState("bond"); // 'move' or 'bond'
  const [selectedOrbital, setSelectedOrbital] = useState(null);
  const svgRef = useRef(null);

  // Function to add a new atom
  const addAtom = (e) => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX || e.touches[0].clientX;
    const y = e.clientY || e.touches[0].clientY;
    const svgX = x - rect.left;
    const svgY = y - rect.top;
    setAtoms((prev) => [...prev, { x: svgX, y: svgY }]);
  };

  // Function to delete an atom
  const deleteAtom = (indexToDelete) => {
    setAtoms((prev) => prev.filter((_, index) => index !== indexToDelete));
    setBonds((prev) =>
      prev
        .filter(
          ([start, end]) => start !== indexToDelete && end !== indexToDelete
        )
        .map(([start, end]) => [
          start > indexToDelete ? start - 1 : start,
          end > indexToDelete ? end - 1 : end,
        ])
    );
    setSelectedAtom(null);
  };

  // Function to handle atom click for bond creation/deletion
  const handleAtomClick = (index, e) => {
    e.stopPropagation();
    if (mode === "bond") {
      if (selectedAtom === null) {
        setSelectedAtom(index);
      } else if (selectedAtom === index) {
        setSelectedAtom(null);
      } else {
        setBonds((prev) => {
          const bondExists = prev.some(
            ([s, e]) =>
              (s === selectedAtom && e === index) ||
              (s === index && e === selectedAtom)
          );
          if (bondExists) {
            return prev.filter(
              ([s, e]) =>
                !(s === selectedAtom && e === index) &&
                !(s === index && e === selectedAtom)
            );
          } else {
            return [...prev, [selectedAtom, index]];
          }
        });
        setSelectedAtom(null);
      }
    }
  };

  // Function to start dragging an atom
  const startDragging = (index, e) => {
    e.stopPropagation();
    if (mode === "move") {
      setDraggingAtom(index);
    }
  };

  // Function to handle atom dragging
  const drag = (e) => {
    if (draggingAtom === null || !svgRef.current) return;
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX || e.touches[0].clientX;
    const y = e.clientY || e.touches[0].clientY;
    const svgX = x - rect.left;
    const svgY = y - rect.top;
    setAtoms((prev) =>
      prev.map((atom, index) =>
        index === draggingAtom ? { x: svgX, y: svgY } : atom
      )
    );
  };

  // Function to stop dragging
  const stopDragging = () => {
    setDraggingAtom(null);
  };

  // Effect for handling drag events
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleMove = (e) => {
      e.preventDefault();
      drag(e);
    };
    svg.addEventListener("mousemove", handleMove);
    svg.addEventListener("touchmove", handleMove);
    svg.addEventListener("mouseup", stopDragging);
    svg.addEventListener("touchend", stopDragging);
    return () => {
      svg.removeEventListener("mousemove", handleMove);
      svg.removeEventListener("touchmove", handleMove);
      svg.removeEventListener("mouseup", stopDragging);
      svg.removeEventListener("touchend", stopDragging);
    };
  }, [atoms, draggingAtom]);

  // Function to perform Hückel calculation
  const calculateHuckel = () => {
    if (atoms.length === 0) {
      alert("Please add atoms before calculating.");
      return;
    }

    const atomCount = atoms.length;

    // Create adjacency matrix
    const adjacencyMatrix = math.zeros(atomCount, atomCount);
    bonds.forEach(([start, end]) => {
      adjacencyMatrix.set([start, end], 1);
      adjacencyMatrix.set([end, start], 1);
    });

    console.log("Adjacency Matrix:", adjacencyMatrix.toString());

    // Create Hückel matrix (H = αI - βA)
    const huckelMatrix = math.multiply(adjacencyMatrix, -1); // -βA
    for (let i = 0; i < atomCount; i++) {
      huckelMatrix.set([i, i], 0); // Set α term to 0 (energy reference)
    }

    console.log("Hückel Matrix:", huckelMatrix.toString());

    try {
      const ans = math.eigs(huckelMatrix);

      const eigenvalues = ans.values;
      const eigenvectors = ans.eigenvectors;

      console.log("Eigenvalues:", eigenvalues);
      console.log("Eigenvectors:", eigenvectors);

      if (!eigenvalues || !eigenvectors) {
        throw new Error("Failed to compute eigenvalues and eigenvectors");
      }

      // Organize results
      let orbitals = eigenvectors.map((item, i) => {
        const energy = item.value;
        const coefficients = item.vector._data;
        return {
          name: `ψ${i + 1}`,
          energy: energy.toFixed(4),
          coefficients: coefficients.map((vec) => vec.toFixed(4)),
        };
      });

      // Sort orbitals by energy (ascending order)
      orbitals.sort((a, b) => parseFloat(a.energy) - parseFloat(b.energy));

      // Reassign names
      orbitals = orbitals.map((orbital, index) => ({
        ...orbital,
        name: `ψ${index + 1}`,
      }));

      setResults({ orbitals });
      setSelectedOrbital(orbitals[orbitals.length / 2 - 1]); // Select HOMO
    } catch (error) {
      console.error("Error in Hückel calculation:", error);
      let errorMessage = "An error occurred during the calculation. ";
      if (error.message.includes("singular")) {
        errorMessage +=
          "The molecular structure may be invalid or disconnected. Please check your structure.";
      } else if (error.message.includes("convergence")) {
        errorMessage +=
          "The calculation did not converge. Try a simpler structure.";
      } else {
        errorMessage +=
          "Please try a different molecular structure or check the console for more details.";
      }
      alert(errorMessage);
    }
  };

  // Function to validate molecular structure
  const validateStructure = () => {
    if (atoms.length === 0) {
      return "Please add atoms to the structure.";
    }
    if (bonds.length === 0) {
      return "Please add bonds between atoms.";
    }

    // Check connectivity
    const visited = new Set();
    const dfs = (node) => {
      visited.add(node);
      bonds.forEach(([start, end]) => {
        if (start === node && !visited.has(end)) dfs(end);
        if (end === node && !visited.has(start)) dfs(start);
      });
    };
    dfs(0);
    if (visited.size !== atoms.length) {
      return "The molecular structure is disconnected. Please ensure all atoms are connected.";
    }

    return null; // Validation successful
  };

  // Function to handle calculation button click
  const handleCalculate = () => {
    const validationError = validateStructure();
    if (validationError) {
      alert(validationError);
      return;
    }
    calculateHuckel();
  };

  // Energy Level Diagram component
  const EnergyLevelDiagram = ({
    orbitals,
    selectedOrbital,
    onOrbitalSelect,
  }) => {
    if (!orbitals || orbitals.length === 0) return null;
    const maxEnergy = Math.max(...orbitals.map((o) => parseFloat(o.energy)));
    const minEnergy = Math.min(...orbitals.map((o) => parseFloat(o.energy)));
    const range = maxEnergy - minEnergy;
    const padding = range * ENERGY_DIAGRAM_PADDING;
    const yScale = (energy) =>
      (ENERGY_DIAGRAM_HEIGHT * (maxEnergy + padding - parseFloat(energy))) /
      (range + 2 * padding);

    const groupedOrbitals = orbitals.reduce((acc, orbital) => {
      const energy = parseFloat(orbital.energy).toFixed(4);
      if (!acc[energy]) acc[energy] = [];
      acc[energy].push(orbital);
      return acc;
    }, {});

    return (
      <svg
        className="w-full h-72 border border-gray-300 rounded"
        viewBox="0 0 200 300"
      >
        <line x1="0" y1="10" x2="0" y2="290" stroke="currentColor" />{" "}
        {/* Y-axis */}
        {Object.entries(groupedOrbitals).map(
          ([energy, orbitalsGroup], groupIndex) => {
            const isDegenerate = orbitalsGroup.length > 1;
            const groupWidth = isDegenerate
              ? orbitalsGroup.length * ENERGY_LINE_WIDTH +
                (orbitalsGroup.length - 1) * ENERGY_LINE_SPACING
              : ENERGY_LINE_WIDTH;
            const startX = 120 - groupWidth / 2; // Center shift

            return (
              <g key={energy}>
                {orbitalsGroup.map((orbital, index) => {
                  const x = isDegenerate
                    ? startX + index * (ENERGY_LINE_WIDTH + ENERGY_LINE_SPACING)
                    : startX;
                  return (
                    <g
                      key={orbital.name}
                      onClick={() => onOrbitalSelect(orbital)}
                      className="cursor-pointer"
                    >
                      <line
                        x1={x}
                        y1={yScale(energy) + 10} // Consider margin
                        x2={x + ENERGY_LINE_WIDTH}
                        y2={yScale(energy) + 10}
                        stroke={orbital === selectedOrbital ? "red" : "blue"}
                        strokeWidth="4"
                      />
                      <text
                        x={x + ENERGY_LINE_WIDTH + 5}
                        y={yScale(energy) + 10}
                        dominantBaseline="middle"
                        fontSize="12"
                      >
                        {orbital.name}
                      </text>
                    </g>
                  );
                })}
                <text
                  x="-10"
                  y={yScale(energy) + 10}
                  dominantBaseline="middle"
                  fontSize="12"
                  textAnchor="end"
                >
                  {parseFloat(energy * -1).toFixed(2)}
                </text>
              </g>
            );
          }
        )}
        <text
          x="15"
          y="80"
          transform="rotate(-90, 15, 150)"
          fontSize="14"
          textAnchor="middle"
        >
          Energy (β units)
        </text>
      </svg>
    );
  };

  // Hexagon component for atom representation
  const Hexagon = ({ cx, cy, size, ...props }) => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (60 * i * Math.PI) / 180; // 60 degree rotation
      points.push(
        `${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`
      );
    }
    return <polygon points={points.join(" ")} {...props} />;
  };

  // Molecule Editor component
  const MoleculeEditor = () => {
    return (
      <svg
        ref={svgRef}
        className="w-full h-72 border border-gray-300 touch-none rounded"
        onClick={addAtom}
      >
        {/* Draw bonds */}
        {bonds.map(([start, end], index) => (
          <line
            key={index}
            x1={atoms[start]?.x}
            y1={atoms[start]?.y}
            x2={atoms[end]?.x}
            y2={atoms[end]?.y}
            className="stroke-current stroke-2"
          />
        ))}

        {/* Draw atoms */}
        {atoms.map((atom, index) => (
          <g key={index}>
            <Hexagon
              cx={atom.x}
              cy={atom.y}
              size={ATOM_SIZE}
              className={`${
                selectedAtom === index ? "fill-red-500" : "fill-blue-500"
              } ${mode === "move" ? "cursor-move" : "cursor-pointer"}`}
              onClick={(e) => handleAtomClick(index, e)}
              onMouseDown={(e) => startDragging(index, e)}
              onTouchStart={(e) => startDragging(index, e)}
            />
            <text
              x={atom.x}
              y={atom.y}
              className="text-white text-center pointer-events-none"
              dominantBaseline="middle"
              textAnchor="middle"
            >
              {index + 1}
            </text>
            <circle
              cx={atom.x + 15}
              cy={atom.y - 15}
              r="8"
              className="fill-red-500"
              onClick={(e) => {
                e.stopPropagation();
                deleteAtom(index);
              }}
            />
            <text
              x={atom.x + 15}
              y={atom.y - 15}
              className="text-white text-xs text-center"
              dominantBaseline="middle"
              textAnchor="middle"
              onClick={(e) => {
                e.stopPropagation();
                deleteAtom(index);
              }}
            >
              x
            </text>
          </g>
        ))}

        {/* Draw molecular orbitals */}
        {selectedOrbital &&
          atoms.map((atom, index) => {
            const coefficient = parseFloat(selectedOrbital.coefficients[index]);
            const maxRadius = ATOM_SIZE * MAX_ORBITAL_RADIUS_FACTOR;
            const minRadius = ATOM_SIZE;
            const radius =
              minRadius + (maxRadius - minRadius) * Math.abs(coefficient);
            const color =
              coefficient >= 0 ? "rgb(255, 0, 0)" : "rgb(0, 0, 255)";
            return (
              <g key={`orbital-${index}`}>
                <circle
                  cx={atom.x}
                  cy={atom.y}
                  r={radius}
                  className="fill-none stroke-2 pointer-events-none"
                  stroke={color}
                />
                <circle
                  cx={atom.x}
                  cy={atom.y}
                  r={radius - 2}
                  className="pointer-events-none"
                  fill={color}
                  fillOpacity="0.3"
                />
              </g>
            );
          })}
      </svg>
    );
  };

  // Main render function
  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <h1 className="text-2xl font-bold mb-4">Hückel Calculator</h1>

      <p className="mb-4">
        Tap on empty space to add atoms.{" "}
        {mode === "move"
          ? "Drag atoms to move them."
          : "Tap on atoms to create/delete bonds."}
      </p>
      <div className="flex justify-between mb-4">
        <button
          onClick={() => setMode("bond")}
          className={`px-4 py-2 rounded ${
            mode === "bond"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 text-black"
          }`}
        >
          Create Bonds
        </button>
        <button
          onClick={() => setMode("move")}
          className={`px-4 py-2 rounded ${
            mode === "move"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 text-black"
          }`}
        >
          Move Atoms
        </button>
      </div>

      <div className="mb-4">
        <MoleculeEditor />
        {results && (
          <div className="mt-4">
            <EnergyLevelDiagram
              orbitals={results.orbitals}
              selectedOrbital={selectedOrbital}
              onOrbitalSelect={setSelectedOrbital}
            />
          </div>
        )}
      </div>

      <button
        onClick={handleCalculate}
        className="w-full px-4 py-2 mb-4 bg-blue-500 text-white rounded"
      >
        Calculate
      </button>

      {/* Display selected orbital information */}
      {results && selectedOrbital && (
        <div className="border border-gray-300 p-4 mb-4 rounded">
          <h3 className="text-lg font-semibold">
            Selected Orbital: {selectedOrbital.name}
          </h3>
          <p className="font-mono mt-2">
            Energy: {parseFloat(selectedOrbital.energy * -1).toFixed(4)} β
          </p>
          <h4 className="font-semibold mt-2">Coefficients:</h4>
          <ul className="font-mono mt-2">
            {selectedOrbital.coefficients.map((coeff, index) => (
              <li key={index}>
                Atom {(index + 1).toString().padStart(2, " ")}: {coeff}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Display all orbitals information */}
      {results && (
        <div className="border border-gray-300 p-4 mb-4">
          <h3 className="text-lg font-semibold">All Orbitals</h3>
          <table className="w-full mt-2 font-mono">
            <thead>
              <tr>
                <th className="text-center">Orbital</th>
                <th className="text-center">Energy (β)</th>
                <th className="text-center">Occupation</th>
              </tr>
            </thead>
            <tbody>
              {results.orbitals.map((orbital, index) => (
                <tr key={index}>
                  <td className="text-center">{orbital.name.padEnd(4, " ")}</td>
                  <td className="text-center">
                    {parseFloat(orbital.energy * -1)
                      .toFixed(4)
                      .padEnd(8, " ")}
                  </td>
                  <td className="text-center">
                    {index < atoms.length / 2 ? "Occ" : "Vac"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default HuckelCalculator;
