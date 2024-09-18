import React, { useState } from 'react'
import { motion } from 'framer-motion'

interface DropdownProps {
  items: string[]
  selected: string
  setSelected: (selected: string) => void
}

const Dropdown: React.FC<DropdownProps> = ({ items, selected, setSelected }) => {
  const [isOpen, setIsOpen] = useState(false)

  const toggleDropdown = () => {
    setIsOpen((prev) => !prev)
  }

  return (
    <div className="relative inline-block text-left w-[90%] ">
      <div>
        <button
          type="button"
          className="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
          onClick={toggleDropdown}
        >
          {selected}
        </button>
      </div>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="origin-top-right  overflow-auto z-[5] max-h-[250%] absolute right-0 mt-2 w-[100%] rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none"
        >
          <div className="py-1">
            {items.map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  setSelected(item)
                  setIsOpen(false)
                }}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
              >
                {item}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default Dropdown
