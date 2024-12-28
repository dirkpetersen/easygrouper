let selectedUsers = new Set();
let selectedGroup = null;
let allSearchedUsers = new Map(); // Store all searched users with their details

function searchUsers() {
    const query = document.getElementById('userSearchInput').value;
    const spinner = document.getElementById('userSpinner');
    const results = document.getElementById('userSearchResults');
    
    if (query.trim().length < 3) {
        results.innerHTML = '<div class="alert alert-warning">Please enter at least 3 characters to search</div>';
        results.style.display = 'block';
        return;
    }
    
    spinner.style.display = 'block';
    results.style.display = 'none';
    
    fetch(`/api/users/search?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(users => {
            const resultsDiv = document.getElementById('userSearchResults');
            const selectedUsersSection = document.getElementById('selectedUsersSection');
            
            // Store all users in our Map
            users.forEach(user => {
                allSearchedUsers.set(user.id, user);
            });
            
            if (users.length === 0) {
                resultsDiv.innerHTML = '<div class="alert alert-info">No users found</div>';
                selectedUsersSection.style.display = 'none';
            } else {
                selectedUsersSection.style.display = 'block';
                resultsDiv.innerHTML = users.map(user => `
                <div class="user-card ${selectedUsers.has(user.id) ? 'selected' : ''}" 
                     onclick="toggleUser('${user.id}')">
                    <p><strong>${user.name || ''} (${user.id || ''})</strong><br>
                    ${user.email || ''}<br>
                    ${user.jobtitle || ''}<br>
                    ${user.department || ''}</p>
                </div>
            `).join('');
            }
            spinner.style.display = 'none';
            results.style.display = 'grid';
        })
        .catch(error => {
            console.error('Error:', error);
            spinner.style.display = 'none';
            results.style.display = 'grid';
        });
}

function searchGroups() {
    const query = document.getElementById('groupSearchInput').value;
    const spinner = document.getElementById('groupSpinner');
    const results = document.getElementById('groupSearchResults');
    
    if (query.trim().length < 3) {
        results.innerHTML = '<div class="alert alert-warning">Please enter at least 3 characters to search</div>';
        results.style.display = 'block';
        return;
    }
    
    spinner.style.display = 'block';
    results.style.display = 'none';
    
    fetch(`/api/groups/search?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(groups => {
            const resultsDiv = document.getElementById('groupSearchResults');
            const selectedGroupSection = document.getElementById('selectedGroupSection');
            if (groups.length === 0) {
                resultsDiv.innerHTML = '<div class="alert alert-info">No groups found</div>';
                selectedGroupSection.style.display = 'none';
            } else {
                selectedGroupSection.style.display = 'block';
                resultsDiv.innerHTML = groups.map(group => {
                    let memberDisplay;
                    if (!Array.isArray(group.members) || group.members.length === 0) {
                        memberDisplay = '<em>No members</em>';
                    } else {
                        const displayedMembers = group.members.slice(0, 10);
                        const remainingCount = Math.max(0, group.members.length - 10);
                        memberDisplay = displayedMembers.join(', ');
                        if (remainingCount > 0) {
                            memberDisplay += ` <em>and ${remainingCount} more member${remainingCount === 1 ? '' : 's'}</em>`;
                        }
                    }
                    return `
                        <div class="group-card ${selectedGroup?.id === group.id ? 'selected' : ''}"
                             onclick="selectGroup('${group.id}', '${group.name}')"
                             data-group-id="${group.id}">
                            <h5>${group.name.length > 25 ? group.name.substring(0, 25) + '...' : group.name}</h5>
                            ${group.description ? `<p class="text-muted">${group.description}</p>` : ''}
                            <p>Members (${group.members.length}): ${memberDisplay}</p>
                        </div>
                    `;
                }).join('');
            }
            spinner.style.display = 'none';
            results.style.display = 'grid';
        })
        .catch(error => {
            console.error('Error:', error);
            spinner.style.display = 'none';
            results.style.display = 'grid';
        });
}

function toggleUser(id) {
    if (selectedUsers.has(id)) {
        selectedUsers.delete(id);
    } else {
        selectedUsers.add(id);
    }
    updateSelectedUsers();
    // Update the clicked card's selected state using a more precise selector
    const selectedCard = document.querySelector(`.user-card[onclick="toggleUser('${id}')"]`);
    if (selectedCard) {
        selectedCard.classList.toggle('selected');
    }
}

function selectGroup(id, name) {
    selectedGroup = { id: id, name: name };
    updateSelectedGroup();
    document.querySelectorAll('.group-card').forEach(card => {
        card.classList.remove('selected');
        if (card.dataset.groupId === id) {
            card.classList.add('selected');
        }
    });
}

function updateSelectedUsers() {
    const container = document.getElementById('selectedUsers');
    container.innerHTML = Array.from(selectedUsers).map(id => {
        return `
            <span class="selected-item">
                ${id}
                <span class="remove-btn" onclick="toggleUser('${id}')">×</span>
            </span>
        `;
    }).join('');
    
    // Update recipients textarea
    updateRecipients();
}

function updateRecipients() {
    const recipientsArea = document.getElementById('recipientsArea');
    if (!recipientsArea) return;

    const emails = Array.from(selectedUsers).map(id => {
        const user = allSearchedUsers.get(id);
        return user ? user.email : null;
    }).filter(email => email);

    recipientsArea.value = emails.join('; ');
}

function copyRecipients() {
    const recipientsArea = document.getElementById('recipientsArea');
    recipientsArea.select();
    document.execCommand('copy');
    // Deselect the text
    window.getSelection().removeAllRanges();
    
    // Optional: Show feedback
    const button = document.querySelector('[onclick="copyRecipients()"]');
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    setTimeout(() => {
        button.textContent = originalText;
    }, 2000);
}

function updateSelectedGroup() {
    const label = document.getElementById('selectedGroupLabel');
    if (selectedGroup) {
        label.textContent = selectedGroup.name;
    } else {
        label.textContent = 'Please click on a card to select';
    }
}

function updateAddRemoveTab() {
    const addremoveMessage = document.getElementById('addremoveMessage');
    const memberManagement = document.getElementById('memberManagement');
    const combinedMembersList = document.getElementById('combinedMembersList');
    const addAllSection = document.getElementById('addAllSection');

    if (!selectedGroup) {
        addremoveMessage.style.display = 'block';
        memberManagement.style.display = 'none';
        return;
    }

    addremoveMessage.style.display = 'none';
    memberManagement.style.display = 'block';

    fetch(`/api/groups/search?q=${encodeURIComponent(selectedGroup.id)}`)
        .then(response => response.json())
        .then(groups => {
            const group = groups.find(g => g.id === selectedGroup.id);
            if (!group) return;

            const currentMembers = group.members || [];
            let displayMembers = [];

            if (selectedUsers.size > 0) {
                // Get all selected users and sort them (non-members first, then members)
                const allSelectedUsers = Array.from(selectedUsers)
                    .map(id => {
                        const user = allSearchedUsers.get(id);
                        if (user) {
                            return {
                                id: id,
                                name: `${user.name || ''} (${user.id || ''})`,
                                isMember: currentMembers.includes(id)
                            };
                        }
                        return null;
                    })
                    .filter(user => user)
                    .sort((a, b) => {
                        if (a.isMember === b.isMember) return 0;
                        return a.isMember ? 1 : -1;
                    });

                displayMembers = allSelectedUsers;
                
                // Show Add All section only if there are non-members
                const hasNonMembers = displayMembers.some(user => !user.isMember);
                addAllSection.style.display = hasNonMembers ? 'flex' : 'none';
                if (hasNonMembers) {
                    const addAllButton = document.getElementById('addAllButton');
                    addAllButton.textContent = `Add all to ${selectedGroup.name}`;
                }
            } else {
                // Show all current members when no users are selected
                displayMembers = currentMembers.map(id => ({
                    id: id,
                    name: id,
                    isMember: true
                }));
                addAllSection.style.display = 'none';
            }

            // Split users into categories
            const selectedNonMembers = displayMembers.filter(user => !user.isMember && selectedUsers.has(user.id));
            const selectedMembers = displayMembers.filter(user => user.isMember && selectedUsers.has(user.id));
            const nonSelectedMembers = currentMembers
                .filter(id => !selectedUsers.has(id))
                .map(id => ({
                    id: id,
                    name: id,
                    isMember: true
                }));

            // Pagination logic
            const itemsPerPage = 20;
            const currentPage = parseInt(combinedMembersList.dataset.currentPage || '1');
            const startIndex = (currentPage - 1) * itemsPerPage;
            const totalItems = selectedNonMembers.length + selectedMembers.length + nonSelectedMembers.length;
            const totalPages = Math.ceil(totalItems / itemsPerPage);

            // Get current page items for each category
            const getCurrentPageItems = (items) => {
                return items.slice(startIndex, startIndex + itemsPerPage);
            };

            combinedMembersList.innerHTML = `
                <div class="members-grid">
                    ${selectedNonMembers.length > 0 ? `
                        <div class="members-column">
                            <h5 class="text-success mb-3">Users to Add</h5>
                            ${getCurrentPageItems(selectedNonMembers).map(user => `
                                <div class="user-item mb-2">
                                    <span>${user.name}</span>
                                    <button class="btn btn-sm btn-success" onclick="addMember('${user.id}')">Add</button>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    ${selectedMembers.length > 0 ? `
                        <div class="members-column">
                            <h5 class="text-danger mb-3">Selected Members</h5>
                            ${getCurrentPageItems(selectedMembers).map(user => `
                                <div class="user-item mb-2">
                                    <span>${user.name}</span>
                                    <button class="btn btn-sm btn-danger" onclick="removeMember('${user.id}')">Remove</button>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    ${nonSelectedMembers.length > 0 ? `
                        <div class="members-column">
                            <h5 class="text-warning mb-3">Current Members</h5>
                            ${getCurrentPageItems(nonSelectedMembers).map(user => `
                                <div class="user-item mb-2">
                                    <span>${user.name}</span>
                                    <button class="btn btn-sm btn-warning" onclick="removeMember('${user.id}')">Remove</button>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                ${totalPages > 1 ? `
                    <div class="pagination-controls mt-3">
                        <button class="btn btn-secondary" 
                                onclick="changeMembersPage(${currentPage - 1})"
                                ${currentPage === 1 ? 'disabled' : ''}>
                            Previous
                        </button>
                        <span class="mx-3">Page ${currentPage} of ${totalPages}</span>
                        <button class="btn btn-secondary" 
                                onclick="changeMembersPage(${currentPage + 1})"
                                ${currentPage === totalPages ? 'disabled' : ''}>
                            Next
                        </button>
                    </div>
                ` : ''}`;
            
            combinedMembersList.dataset.currentPage = currentPage;
        });
}

function removeMember(userId) {
    if (!selectedGroup) return;
    
    fetch('/api/submit-changes', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            users: [userId],
            group: selectedGroup.id
        })
    })
    .then(response => response.json())
    .then(() => {
        updateAddRemoveTab();
    })
    .catch(error => {
        alert('Error removing member');
        console.error('Error:', error);
    });
}

function addMember(userId) {
    if (!selectedGroup) return;
    
    fetch('/api/submit-changes', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            users: [userId],
            group: selectedGroup.id
        })
    })
    .then(response => response.json())
    .then(() => {
        updateAddRemoveTab();
    })
    .catch(error => {
        alert('Error adding member');
        console.error('Error:', error);
    });
}

function addAllMembers() {
    if (!selectedGroup) return;
    
    fetch(`/api/groups/search?q=${encodeURIComponent(selectedGroup.id)}`)
        .then(response => response.json())
        .then(groups => {
            const group = groups.find(g => g.id === selectedGroup.id);
            if (!group) return;

            const currentMembers = group.members || [];
            const nonMembers = Array.from(selectedUsers)
                .filter(id => !currentMembers.includes(id));

            if (nonMembers.length === 0) return;

            fetch('/api/submit-changes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    users: nonMembers,
                    group: selectedGroup.id
                })
            })
            .then(response => response.json())
            .then(() => {
                updateAddRemoveTab();
            })
            .catch(error => {
                alert('Error adding members');
                console.error('Error:', error);
            });
        });
}

function changeMembersPage(newPage) {
    const combinedMembersList = document.getElementById('combinedMembersList');
    combinedMembersList.dataset.currentPage = newPage;
    updateAddRemoveTab();
}


// Initialize Bootstrap tabs
document.addEventListener('DOMContentLoaded', function() {
    var triggerTabList = [].slice.call(document.querySelectorAll('#mainTabs button'));
    triggerTabList.forEach(function(triggerEl) {
        triggerEl.addEventListener('shown.bs.tab', function (event) {
            if (event.target.id === 'addremove-tab') {
                updateAddRemoveTab();
            }
        });
        new bootstrap.Tab(triggerEl);
    });
});
