import { AEUI, watch, clean } from 'aeui';

// Simple child component to test props and events
function ListItem({ text, onDelete }) {
  return (
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px; border-bottom: 1px solid #eee;">
      <span>{text}</span>
      <button 
        onClick={onDelete}
        style="background: #ff4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;"
      >
        Delete
      </button>
    </div>
  );
}

export default function ComplexExample() {
  // 1. Local State
  let count = 0;
  let textInput = "";
  let showList = true;
  let items = ["Apple", "Banana", "Cherry"];
  let timer = 0;

  // 2. Lifecycle / Ref (using clean for cleanup)
  const intervalId = setInterval(() => {
    timer++;
  }, 1000);

  clean(() => {
    clearInterval(intervalId);
    console.log("ComplexExample unmounted, timer cleared.");
  });

  // 3. Reactivity (Watch)
  watch([count], () => {
    console.log(`[ComplexExample] Count updated: ${count}`);
  });

  watch([items], () => {
    console.log(`[ComplexExample] List updated, length: ${items.length}`);
  });

  // 4. Methods
  const handleAdd = () => {
    if (textInput.trim()) {
      // items = [...items, textInput];
      items.push(textInput);
      textInput = "";
    }
  };

  const handleDelete = (indexToDelete) => {
    // items = items.filter((_, index) => index !== indexToDelete);
    items.splice(indexToDelete, 1);
  };

  return (
    <div style="font-family: sans-serif; max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h2 style="border-bottom: 2px solid #646cff; padding-bottom: 10px;">AEUI Complex Interaction Test</h2>
      
      {/* Timer Section */}
      <div style="margin-bottom: 20px; padding: 10px; background: #f9f9f9; border-radius: 4px;">
        <strong>Active Timer:</strong> {timer}s
      </div>

      {/* Counter Section */}
      <div style="margin-bottom: 20px;">
        <h3>1. State & Event Handling</h3>
        <p>Current Count: <strong>{count}</strong></p>
        <div style="display: flex; gap: 10px;">
           <button onClick={() => count++}>Increment (+)</button>
           <button onClick={() => count--}>Decrement (-)</button>
        </div>
      </div>

      {/* Conditional Rendering Section */}
      <div style="margin-bottom: 20px;">
        <h3>2. Conditional Rendering</h3>
        <label style="display: flex; align-items: center; cursor: pointer; user-select: none;">
          <input 
            type="checkbox" 
            checked={showList} 
            onChange={(e) => showList = e.target.checked} 
            style="margin-right: 8px;"
          />
          Show List Section
        </label>
      </div>

      {/* List Rendering Section */}
      {showList && (
        <div style="animation: fadeIn 0.3s;">
          <h3>3. List & Input</h3>
          <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <input 
              value={textInput}
              onInput={(e) => textInput = e.target.value}
              placeholder="Type new item..."
              style="flex: 1; padding: 8px;"
            />
            <button onClick={handleAdd}>Add Item</button>
          </div>
          
          <div style="border: 1px solid #eee; border-radius: 4px;">
            {items.length === 0 ? (
                <div style="padding: 10px; color: #888; text-align: center;">No items in the list</div>
            ) : (
                items.map((item, index) => (
                    <ListItem 
                        key={index} // Using index as key for simplicity in this demo, though IDs are better
                        text={item} 
                        onDelete={() => handleDelete(index)} 
                    />
                ))
            )}
          </div>
          <p style="font-size: 0.8em; color: #666; margin-top: 5px;">Total items: {items.length}</p>
        </div>
      )}
    </div>
  );
}
