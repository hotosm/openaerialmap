#ifndef _OPTIMISER_H
#define _OPTIMISER_H

#include <string>

class Optimiser {
public:
    // Returns "" on success, otherwise a message for the user.
    static std::string run(const std::string& srcPath, const std::string& dstPath);
};

#endif
